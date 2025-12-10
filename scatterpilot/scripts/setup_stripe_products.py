#!/usr/bin/env python3
"""
Setup Stripe products and prices for ScatterPilot
Run this script once to create the required Stripe products
"""

import stripe
import os
import json

# Configuration - Replace with your actual Stripe secret key
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', 'sk_test_YOUR_KEY_HERE')

stripe.api_key = STRIPE_SECRET_KEY

def create_pro_product():
    """Create ScatterPilot Pro product and price"""

    # Check if product already exists
    products = stripe.Product.list(active=True, limit=100)
    for product in products.data:
        if product.name == "ScatterPilot Pro":
            print(f"Product already exists: {product.id}")

            # Get prices for this product
            prices = stripe.Price.list(product=product.id, active=True)
            if prices.data:
                price = prices.data[0]
                print(f"Price already exists: {price.id}")
                return product.id, price.id
            else:
                # Create price if product exists but no price
                price = stripe.Price.create(
                    product=product.id,
                    unit_amount=1800,  # $18.00 in cents
                    currency='usd',
                    recurring={
                        'interval': 'month',
                        'interval_count': 1
                    },
                    metadata={
                        'tier': 'pro',
                        'invoices_per_month': 'unlimited'
                    }
                )
                print(f"Created new price: {price.id}")
                return product.id, price.id

    # Create new product
    product = stripe.Product.create(
        name="ScatterPilot Pro",
        description="Unlimited invoices per month with all features",
        metadata={
            'tier': 'pro',
            'invoices_per_month': 'unlimited'
        }
    )
    print(f"Created product: {product.id}")

    # Create price
    price = stripe.Price.create(
        product=product.id,
        unit_amount=1800,  # $18.00 in cents
        currency='usd',
        recurring={
            'interval': 'month',
            'interval_count': 1
        },
        metadata={
            'tier': 'pro'
        }
    )
    print(f"Created price: {price.id}")

    return product.id, price.id


def setup_customer_portal():
    """Configure customer portal for subscription management"""
    try:
        # Create portal configuration
        configuration = stripe.billing_portal.Configuration.create(
            business_profile={
                'headline': 'ScatterPilot Subscription Management',
            },
            features={
                'subscription_cancel': {
                    'enabled': True,
                    'mode': 'at_period_end',
                    'cancellation_reason': {
                        'enabled': True,
                        'options': [
                            'too_expensive',
                            'missing_features',
                            'switched_service',
                            'unused',
                            'other'
                        ]
                    }
                },
                'payment_method_update': {
                    'enabled': True
                },
                'invoice_history': {
                    'enabled': True
                }
            }
        )
        print(f"Created portal configuration: {configuration.id}")
        return configuration.id
    except stripe.error.StripeError as e:
        print(f"Portal configuration error (may already exist): {e}")
        return None


def main():
    print("=" * 60)
    print("ScatterPilot Stripe Setup")
    print("=" * 60)

    if STRIPE_SECRET_KEY == 'sk_test_YOUR_KEY_HERE':
        print("\nERROR: Please set your STRIPE_SECRET_KEY environment variable")
        print("Example: export STRIPE_SECRET_KEY=sk_test_xxxxx")
        return

    print(f"\nUsing API key: {STRIPE_SECRET_KEY[:12]}...")

    # Create products and prices
    print("\n1. Creating products and prices...")
    product_id, price_id = create_pro_product()

    # Setup customer portal
    print("\n2. Setting up customer portal...")
    portal_config_id = setup_customer_portal()

    # Output configuration
    print("\n" + "=" * 60)
    print("SETUP COMPLETE!")
    print("=" * 60)
    print("\nAdd these values to your environment/SAM template:")
    print(f"\nSTRIPE_PRO_PRODUCT_ID={product_id}")
    print(f"STRIPE_PRO_PRICE_ID={price_id}")
    if portal_config_id:
        print(f"STRIPE_PORTAL_CONFIG_ID={portal_config_id}")

    # Save to JSON for easy reference
    config = {
        'product_id': product_id,
        'price_id': price_id,
        'portal_config_id': portal_config_id
    }

    with open('stripe_config.json', 'w') as f:
        json.dump(config, f, indent=2)

    print("\nConfiguration saved to stripe_config.json")


if __name__ == '__main__':
    main()
