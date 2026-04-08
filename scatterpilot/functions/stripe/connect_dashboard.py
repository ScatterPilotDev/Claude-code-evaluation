"""
Lambda function: Get Stripe Connect Dashboard Link
POST /stripe/connect/dashboard-link

For Stripe Standard connected accounts the user owns their own Stripe account
and logs in with their own credentials at dashboard.stripe.com.
This endpoint verifies the user has a connected account and returns the URL.

Note: Express/Custom connected accounts use stripe.Account.create_login_link()
to generate a single-use SSO link. Standard accounts don't support that — users
authenticate directly at the Stripe dashboard.
"""

import json
import os
import sys

sys.path.insert(0, '/opt/python')

import boto3
from botocore.exceptions import ClientError

from common.security import extract_user_id_from_event
from common.logger import get_logger

logger = get_logger("connect_dashboard")

SUBSCRIPTIONS_TABLE = os.environ['SUBSCRIPTIONS_TABLE']

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(SUBSCRIPTIONS_TABLE)

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
}

STRIPE_DASHBOARD_URL = 'https://dashboard.stripe.com'


def handler(event: dict, context) -> dict:
    try:
        user_id = extract_user_id_from_event(event)
        logger.info(f"Dashboard link requested for user: {user_id}")

        # Verify the user has a connected account
        db_response = table.get_item(
            Key={'user_id': user_id},
            ProjectionExpression='stripe_connected_account_id, stripe_connect_status',
        )
        user_data = db_response.get('Item', {})
        account_id = user_data.get('stripe_connected_account_id')

        if not account_id:
            logger.warning(f"Dashboard link requested but no account for user: {user_id}")
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'error': 'No connected Stripe account found. Complete onboarding first.',
                }),
            }

        logger.info(f"Returning dashboard URL for account: {account_id}")

        # Standard accounts use their own Stripe credentials to access the full
        # Stripe dashboard. Return the standard dashboard URL.
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'url': STRIPE_DASHBOARD_URL,
                'accountId': account_id,
            }),
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
            'body': json.dumps({'error': 'Failed to get dashboard link'}),
        }
