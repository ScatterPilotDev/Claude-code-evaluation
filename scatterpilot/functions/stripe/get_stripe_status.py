"""
Lambda function to get user's Stripe connection status
Returns whether user has connected Stripe and their account ID
"""
import json
import os
import boto3
from decimal import Decimal
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()
tracer = Tracer()
dynamodb = boto3.resource('dynamodb')

SUBSCRIPTIONS_TABLE = os.environ['SUBSCRIPTIONS_TABLE']
table = dynamodb.Table(SUBSCRIPTIONS_TABLE)


class DecimalEncoder(json.JSONEncoder):
    """Helper class to convert Decimal objects to int/float for JSON serialization"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)


@tracer.capture_lambda_handler
@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    """
    Get user's Stripe connection status

    Returns:
        - connected: boolean
        - stripeAccountId: string or null
        - connectedAt: ISO timestamp or null
    """
    try:
        # Extract user ID from Cognito authorizer
        user_id = event['requestContext']['authorizer']['claims']['sub']
        logger.info(f"Getting Stripe status for user: {user_id}")

        # Get user's subscription record
        response = table.get_item(
            Key={'user_id': user_id},
            ProjectionExpression='stripe_account_id, stripe_connected_at'
        )

        user_data = response.get('Item', {})
        stripe_account_id = user_data.get('stripe_account_id')
        stripe_connected_at = user_data.get('stripe_connected_at')

        logger.info(f"Stripe status: connected={bool(stripe_account_id)}")

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,OPTIONS'
            },
            'body': json.dumps({
                'connected': bool(stripe_account_id),
                'stripeAccountId': stripe_account_id if stripe_account_id else None,
                'connectedAt': stripe_connected_at if stripe_connected_at else None
            }, cls=DecimalEncoder)
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
                'error': 'Invalid request - missing authorization'
            })
        }

    except Exception as e:
        logger.error(f"Error getting Stripe status: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Failed to get Stripe status'
            })
        }
