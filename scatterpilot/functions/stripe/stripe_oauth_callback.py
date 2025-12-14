"""
Lambda function to handle Stripe OAuth callback
Exchanges authorization code for access token and stores in DynamoDB
"""
import json
import os
import boto3
import urllib.request
import urllib.parse
from datetime import datetime
from decimal import Decimal
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()
tracer = Tracer()
dynamodb = boto3.resource('dynamodb')

SUBSCRIPTIONS_TABLE = os.environ['SUBSCRIPTIONS_TABLE']
STRIPE_CLIENT_ID = os.environ['STRIPE_CLIENT_ID']
STRIPE_SECRET_KEY = os.environ['STRIPE_SECRET_KEY']

table = dynamodb.Table(SUBSCRIPTIONS_TABLE)


class DecimalEncoder(json.JSONEncoder):
    """Helper class to convert Decimal objects to int/float for JSON serialization"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)


def exchange_code_for_token(code: str) -> dict:
    """
    Exchange authorization code for Stripe access token

    Args:
        code: Authorization code from Stripe OAuth

    Returns:
        Dict with stripe_user_id and access_token
    """
    logger.info("Exchanging code for Stripe access token")

    # Prepare request data
    post_data = urllib.parse.urlencode({
        'grant_type': 'authorization_code',
        'code': code,
        'client_secret': STRIPE_SECRET_KEY
    }).encode('utf-8')

    # Make request to Stripe
    req = urllib.request.Request(
        'https://connect.stripe.com/oauth/token',
        data=post_data,
        headers={
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    )

    try:
        with urllib.request.urlopen(req) as response:
            response_data = json.loads(response.read().decode('utf-8'))

            if 'error' in response_data:
                error_msg = response_data.get('error_description', response_data.get('error'))
                logger.error(f"Stripe OAuth error: {error_msg}")
                raise Exception(error_msg)

            logger.info(f"Successfully obtained Stripe token for account: {response_data.get('stripe_user_id')}")
            return response_data

    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        logger.error(f"HTTP error from Stripe: {error_body}")
        raise Exception(f"Stripe API error: {error_body}")


@tracer.capture_lambda_handler
@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    """
    Handle Stripe OAuth callback

    Expected body:
        - code: Authorization code from Stripe
        - state: User ID for security verification

    Returns:
        - success: boolean
        - stripeAccountId: string
    """
    try:
        # Extract user ID from Cognito authorizer
        user_id = event['requestContext']['authorizer']['claims']['sub']
        logger.info(f"Processing OAuth callback for user: {user_id}")

        # Parse request body
        body = json.loads(event['body'])
        code = body.get('code')
        state = body.get('state')

        if not code:
            logger.error("Missing authorization code")
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': 'Missing authorization code'
                })
            }

        # Security check: verify state matches user ID
        if state != user_id:
            logger.error(f"State mismatch: {state} != {user_id}")
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': 'Invalid state parameter - security check failed'
                })
            }

        # Check subscription tier - Stripe integration requires Pro
        subscription_response = table.get_item(Key={'user_id': user_id})

        if 'Item' not in subscription_response:
            logger.warning(f"No subscription record found for user: {user_id}")
            return {
                'statusCode': 403,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': 'Pro subscription required',
                    'message': 'Stripe payment integration is only available for Pro tier subscribers. Upgrade to Pro to receive payments directly.',
                    'requiresUpgrade': True
                })
            }

        subscription_status = subscription_response['Item'].get('subscription_status', 'free')

        if subscription_status != 'pro':
            logger.warning(f"User {user_id} attempted Stripe connection with {subscription_status} tier")
            return {
                'statusCode': 403,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': 'Pro subscription required',
                    'message': 'Stripe payment integration is only available for Pro tier subscribers. Upgrade to Pro to receive payments directly.',
                    'requiresUpgrade': True
                })
            }

        logger.info(f"Subscription tier check passed: {subscription_status}")

        # Exchange code for access token
        token_data = exchange_code_for_token(code)

        if not token_data.get('stripe_user_id'):
            raise Exception('No Stripe account ID returned')

        stripe_account_id = token_data['stripe_user_id']
        access_token = token_data['access_token']

        # Store in DynamoDB
        now = datetime.utcnow().isoformat()

        # Update existing subscription record (we already verified it exists above)
        table.update_item(
            Key={'user_id': user_id},
            UpdateExpression='SET stripe_account_id = :account_id, stripe_access_token = :token, stripe_connected_at = :now, updated_at = :now',
            ExpressionAttributeValues={
                ':account_id': stripe_account_id,
                ':token': access_token,
                ':now': now
            }
        )

        logger.info(f"Stripe connected successfully: {stripe_account_id}")

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'POST,OPTIONS'
            },
            'body': json.dumps({
                'success': True,
                'stripeAccountId': stripe_account_id
            })
        }

    except KeyError as e:
        logger.error(f"Missing required field: {e}")
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': f'Invalid request - missing field: {str(e)}'
            })
        }

    except Exception as e:
        logger.error(f"Error processing OAuth callback: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': str(e) if str(e) else 'Failed to connect Stripe account'
            })
        }
