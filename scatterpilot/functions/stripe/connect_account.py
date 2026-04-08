"""
Lambda function: Create Stripe Standard Connected Account
POST /stripe/connect/account

Creates a new Stripe Standard connected account for the authenticated user
and returns an Account Link URL to redirect them through Stripe's hosted
onboarding flow. Idempotent — if the user already has an account, returns
a fresh Account Link for the existing account instead of creating a new one.

DynamoDB fields written:
  stripe_connected_account_id  — the acct_... ID from Stripe
  stripe_connect_status        — 'pending' (set to 'active' by connect_status.py
                                  once details_submitted becomes true)
  stripe_connect_created_at    — ISO timestamp
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

logger = get_logger("connect_account")

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
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
}


def _create_account_link(account_id: str) -> str:
    """Create a Stripe Account Link for the hosted onboarding wizard."""
    link = stripe.AccountLink.create(
        account=account_id,
        refresh_url=f"{FRONTEND_URL}/app/settings/payments?refresh=true",
        return_url=f"{FRONTEND_URL}/app/settings/payments?onboarding=complete",
        type='account_onboarding',
    )
    return link.url


def handler(event: dict, context) -> dict:
    try:
        user_id = extract_user_id_from_event(event)
        # Email is available from the Cognito JWT claims
        claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
        user_email = claims.get('email', '')

        logger.info(f"Stripe Connect account request for user: {user_id}")

        # ── Idempotency check ──────────────────────────────────────────────
        db_response = table.get_item(
            Key={'user_id': user_id},
            ProjectionExpression='stripe_connected_account_id, stripe_connect_status',
        )
        existing = db_response.get('Item', {})
        existing_account_id = existing.get('stripe_connected_account_id')

        if existing_account_id:
            logger.info(f"User already has connected account {existing_account_id} — issuing fresh link")
            onboarding_url = _create_account_link(existing_account_id)
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'url': onboarding_url,
                    'accountId': existing_account_id,
                    'existing': True,
                }),
            }

        # ── Create a new Standard connected account ────────────────────────
        account = stripe.Account.create(
            type='standard',
            email=user_email or None,
            metadata={'scatterpilot_user_id': user_id},
        )
        account_id = account.id
        logger.info(f"Created Stripe connected account: {account_id}")

        # ── Persist account ID before redirecting (so we can recover on refresh) ──
        now = datetime.utcnow().isoformat()
        table.update_item(
            Key={'user_id': user_id},
            UpdateExpression=(
                'SET stripe_connected_account_id = :acct, '
                'stripe_connect_status = :status, '
                'stripe_connect_created_at = :now, '
                'updated_at = :now'
            ),
            ExpressionAttributeValues={
                ':acct': account_id,
                ':status': 'pending',
                ':now': now,
            },
        )
        logger.info(f"Saved connected account {account_id} for user {user_id}")

        # ── Generate Account Link for Stripe's hosted onboarding ──────────
        onboarding_url = _create_account_link(account_id)

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'url': onboarding_url,
                'accountId': account_id,
                'existing': False,
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
            'body': json.dumps({'error': 'Failed to create connected account'}),
        }
