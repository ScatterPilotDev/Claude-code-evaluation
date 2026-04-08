"""
Lambda function: Get Stripe Connect Status
GET /stripe/connect/status

Returns the live status of the user's Stripe Standard connected account.
If the account exists but onboarding isn't complete (details_submitted=false),
generates a fresh Account Link so the user can resume Stripe's wizard.
Also syncs stripe_connect_status in DynamoDB when the account becomes active.

Response shape:
  { connected: false }
  OR
  {
    connected:        true,
    accountId:        "acct_...",
    chargesEnabled:   bool,
    payoutsEnabled:   bool,
    detailsSubmitted: bool,
    onboardingUrl:    string | null,   # null if onboarding complete
    status:           "pending" | "active",
    connectedAt:      ISO string | null,
  }
"""

import json
import os
import sys
from datetime import datetime

sys.path.insert(0, '/opt/python')

import boto3
import stripe
from botocore.exceptions import ClientError

from common.security import extract_user_id_from_event
from common.logger import get_logger

logger = get_logger("connect_status")

# TODO: STRIPE_SECRET_KEY must be set in the CloudFormation parameter
#       StripeSecretKey (NoEcho) before deploying to production.
stripe.api_key = os.environ['STRIPE_SECRET_KEY']
FRONTEND_URL = os.environ['FRONTEND_URL']
SUBSCRIPTIONS_TABLE = os.environ['SUBSCRIPTIONS_TABLE']

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(SUBSCRIPTIONS_TABLE)

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
}


def handler(event: dict, context) -> dict:
    try:
        user_id = extract_user_id_from_event(event)
        logger.info(f"Getting Stripe Connect status for user: {user_id}")

        # ── Fetch stored account ID from DynamoDB ──────────────────────────
        db_response = table.get_item(
            Key={'user_id': user_id},
            ProjectionExpression=(
                'stripe_connected_account_id, '
                'stripe_connect_status, '
                'stripe_connect_created_at'
            ),
        )
        user_data = db_response.get('Item', {})
        account_id = user_data.get('stripe_connected_account_id')

        if not account_id:
            logger.info(f"No connected account found for user: {user_id}")
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'connected': False}),
            }

        # ── Retrieve live account state from Stripe ────────────────────────
        account = stripe.Account.retrieve(account_id)
        logger.info(
            f"Account {account_id}: charges_enabled={account.charges_enabled}, "
            f"details_submitted={account.details_submitted}"
        )

        # ── Generate a fresh onboarding link if not yet complete ───────────
        onboarding_url = None
        if not account.details_submitted:
            account_link = stripe.AccountLink.create(
                account=account_id,
                refresh_url=f"{FRONTEND_URL}/app/settings/payments?refresh=true",
                return_url=f"{FRONTEND_URL}/app/settings/payments?onboarding=complete",
                type='account_onboarding',
            )
            onboarding_url = account_link.url
            logger.info(f"Generated fresh onboarding link for {account_id}")

        # ── Sync status to DynamoDB if it has changed ──────────────────────
        new_status = 'active' if account.charges_enabled else 'pending'
        stored_status = user_data.get('stripe_connect_status')
        if new_status != stored_status:
            logger.info(f"Updating Connect status from '{stored_status}' to '{new_status}'")
            table.update_item(
                Key={'user_id': user_id},
                UpdateExpression='SET stripe_connect_status = :status, updated_at = :now',
                ExpressionAttributeValues={
                    ':status': new_status,
                    ':now': datetime.utcnow().isoformat(),
                },
            )

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'connected': True,
                'accountId': account_id,
                'chargesEnabled': account.charges_enabled,
                'payoutsEnabled': account.payouts_enabled,
                'detailsSubmitted': account.details_submitted,
                'onboardingUrl': onboarding_url,
                'status': new_status,
                'connectedAt': user_data.get('stripe_connect_created_at'),
            }),
        }

    except stripe.error.StripeError as e:
        logger.error(f"Stripe API error: {str(e)}")
        return {
            'statusCode': 502,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Stripe error: {str(e)}'}),
        }
    except ClientError as e:
        logger.error(f"DynamoDB error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Database error'}),
        }
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Failed to get Connect status'}),
        }
