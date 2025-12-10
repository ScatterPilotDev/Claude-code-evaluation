#!/usr/bin/env python3
"""
Local testing script for Bedrock conversation flow
Tests the invoice extraction without deploying to AWS
"""

import sys
import os
import json
from datetime import datetime

# Add layers to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'layers', 'common'))

from bedrock_client import BedrockClient, BedrockException
from models import Conversation, ConversationState
from logger import get_logger

logger = get_logger("local_test")


def print_separator():
    """Print a visual separator"""
    print("\n" + "=" * 80 + "\n")


def run_conversation_test():
    """
    Run an interactive conversation test with Bedrock
    Simulates the invoice creation flow
    """
    print_separator()
    print("ScatterPilot - Local Bedrock Conversation Test")
    print_separator()

    # Initialize
    bedrock_client = BedrockClient(region_name=os.environ.get('AWS_REGION', 'us-east-1'))
    conversation = Conversation(user_id="local-test-user")

    print("Starting conversation...")
    print("Type 'quit' to exit, 'reset' to start over")
    print_separator()

    # Initial greeting
    initial_message = "Hello! I'd like to create an invoice."

    try:
        response, extracted_data = bedrock_client.process_conversation_turn(
            conversation,
            initial_message
        )

        print(f"USER: {initial_message}")
        print(f"\nASSISTANT: {response}")
        print_separator()

        # Interactive loop
        while True:
            # Get user input
            user_input = input("YOU: ").strip()

            if user_input.lower() == 'quit':
                print("\nExiting conversation test.")
                break

            if user_input.lower() == 'reset':
                conversation = Conversation(user_id="local-test-user")
                print("\nConversation reset.")
                continue

            if not user_input:
                continue

            # Process turn
            response, extracted_data = bedrock_client.process_conversation_turn(
                conversation,
                user_input
            )

            print(f"\nASSISTANT: {response}")

            # Check if invoice data was extracted
            if extracted_data:
                action = extracted_data.get('action')

                if action == 'create_invoice':
                    print_separator()
                    print("INVOICE DATA EXTRACTED!")
                    print_separator()
                    print(json.dumps(extracted_data, indent=2))
                    print_separator()

                    # Validate the data
                    try:
                        invoice_data = bedrock_client.validate_and_parse_invoice_data(extracted_data)
                        print("\nINVOICE VALIDATION: PASSED ✓")
                        print("\nSummary:")
                        print(bedrock_client.generate_invoice_summary(invoice_data))
                        print_separator()
                        print("\nConversation complete! Type 'reset' to start over or 'quit' to exit.")

                    except ValueError as e:
                        print(f"\nINVOICE VALIDATION: FAILED ✗")
                        print(f"Error: {str(e)}")
                        print("\nContinue the conversation to fix the issues...")

                elif action == 'cancel':
                    print("\nConversation cancelled.")
                    break

            print_separator()

        # Show conversation stats
        print("\nConversation Statistics:")
        print(f"  Messages exchanged: {len(conversation.messages)}")
        print(f"  Final state: {conversation.state.value}")
        print(f"  Conversation ID: {conversation.conversation_id}")

    except BedrockException as e:
        print(f"\nERROR: Bedrock API error occurred")
        print(f"Details: {str(e)}")
        print("\nTroubleshooting:")
        print("  1. Ensure you have AWS credentials configured")
        print("  2. Verify Bedrock access in your AWS account")
        print("  3. Check that the region supports Bedrock (us-east-1, us-west-2)")
        print("  4. Ensure model access is enabled in Bedrock console")

    except KeyboardInterrupt:
        print("\n\nConversation interrupted by user.")

    except Exception as e:
        print(f"\nUNEXPECTED ERROR: {str(e)}")
        import traceback
        traceback.print_exc()


def test_invoice_validation():
    """
    Test invoice data validation without Bedrock
    """
    print_separator()
    print("Testing Invoice Data Validation")
    print_separator()

    bedrock_client = BedrockClient()

    # Test data
    test_invoice = {
        "action": "create_invoice",
        "data": {
            "customer_name": "Acme Corporation",
            "customer_email": "billing@acme.com",
            "customer_address": "123 Main St, City, ST 12345",
            "invoice_date": "2024-01-15",
            "due_date": "2024-02-15",
            "line_items": [
                {
                    "description": "Professional Consulting Services - January 2024",
                    "quantity": "40",
                    "unit_price": "150.00"
                },
                {
                    "description": "Software License Fee",
                    "quantity": "1",
                    "unit_price": "500.00"
                }
            ],
            "tax_rate": "0.08",
            "discount": "100.00",
            "notes": "Payment due within 30 days. Thank you for your business!"
        }
    }

    print("Test Invoice Data:")
    print(json.dumps(test_invoice, indent=2))
    print_separator()

    try:
        # Validate
        invoice_data = bedrock_client.validate_and_parse_invoice_data(test_invoice)
        print("VALIDATION: PASSED ✓\n")

        # Generate summary
        print("Invoice Summary:")
        print(bedrock_client.generate_invoice_summary(invoice_data))
        print_separator()

        # Show calculations
        print("Calculations:")
        print(f"  Subtotal: ${invoice_data.subtotal}")
        print(f"  Discount: ${invoice_data.discount}")
        print(f"  Tax ({invoice_data.tax_rate * 100}%): ${invoice_data.tax_amount}")
        print(f"  TOTAL: ${invoice_data.total}")
        print_separator()

    except ValueError as e:
        print(f"VALIDATION: FAILED ✗")
        print(f"Error: {str(e)}")


def main():
    """Main entry point"""
    print("\n" + "=" * 80)
    print(" " * 20 + "ScatterPilot Local Test Suite")
    print("=" * 80)

    if len(sys.argv) > 1 and sys.argv[1] == 'validate':
        # Just test validation
        test_invoice_validation()
    else:
        # Run interactive conversation
        print("\nMode: Interactive Conversation")
        print("\nPrerequisites:")
        print("  - AWS credentials configured (aws configure)")
        print("  - Bedrock model access enabled")
        print("  - Internet connection")
        run_conversation_test()

    print("\n" + "=" * 80 + "\n")


if __name__ == '__main__':
    main()
