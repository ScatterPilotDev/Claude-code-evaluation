"""
Lambda function to disconnect user's Stripe account
Revokes Stripe access and removes credentials from DynamoDB
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


def revoke_stripe_access(stripe_account_id: str) -> None:
    """
    Revoke Stripe Connect access

    Args:
        stripe_account_id: Stripe account ID to revoke
    """
    logger.info(f"Revoking Stripe access for account: {stripe_account_id}")

    # Prepare request data
    post_data = urllib.parse.urlencode({
        'client_id': STRIPE_CLIENT_ID,
        'stripe_user_id': stripe_account_id
    }).encode('utf-8')

    # Make request to Stripe
    req = urllib.request.Request(
        'https://connect.stripe.com/oauth/deauthorize',
        data=post_data,
        headers={
            'Authorization': f'Bearer {STRIPE_SECRET_KEY}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    )

    try:
        with urllib.request.urlopen(req) as response:
            response_data = json.loads(response.read().decode('utf-8'))

            if 'error' in response_data:
                error_msg = response_data.get('error_description', response_data.get('error'))
                logger.error(f"Stripe deauthorize error: {error_msg}")
                raise Exception(error_msg)

            logger.info(f"Successfully revoked Stripe access for account: {stripe_account_id}")

    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        logger.error(f"HTTP error from Stripe: {error_body}")
        # Don't raise exception - we still want to remove from our database
        # even if Stripe revocation fails
        logger.warning("Continuing with database cleanup despite Stripe error")


@tracer.capture_lambda_handler
@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    """
    Disconnect user's Stripe account

    Returns:
        - success: boolean
        - message: string
    """
    try:
        # Extract user ID from Cognito authorizer
        user_id = event['requestContext']['authorizer']['claims']['sub']
        logger.info(f"Disconnecting Stripe for user: {user_id}")

        # Get user's current Stripe account
        response = table.get_item(
            Key={'user_id': user_id},
            ProjectionExpression='stripe_account_id'
        )

        if 'Item' not in response or not response['Item'].get('stripe_account_id'):
            logger.warning(f"No Stripe account found for user: {user_id}")
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': 'No Stripe account connected'
                })
            }

        stripe_account_id = response['Item']['stripe_account_id']

        # Revoke access with Stripe
        try:
            revoke_stripe_access(stripe_account_id)
        except Exception as e:
            logger.error(f"Error revoking Stripe access: {e}")
            # Continue with database cleanup even if revocation fails

        # Remove from DynamoDB
        now = datetime.utcnow().isoformat()
        table.update_item(
            Key={'user_id': user_id},
            UpdateExpression='REMOVE stripe_account_id, stripe_access_token, stripe_connected_at SET updated_at = :now',
            ExpressionAttributeValues={
                ':now': now
            }
        )

        logger.info(f"Stripe disconnected successfully for user: {user_id}")

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
                'message': 'Stripe account disconnected successfully'
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
        logger.error(f"Error disconnecting Stripe: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Failed to disconnect Stripe account'
            })
        }
