"""
Unit tests for Bedrock client
"""

import json
import pytest
from datetime import date
from decimal import Decimal
from unittest.mock import Mock, patch, MagicMock

from common.bedrock_client import BedrockClient, BedrockException
from common.models import Conversation, Message, InvoiceData, LineItem


class TestBedrockClient:
    """Test suite for BedrockClient"""

    @pytest.fixture
    def bedrock_client(self):
        """Create BedrockClient instance"""
        return BedrockClient(region_name="us-east-1")

    @pytest.fixture
    def mock_bedrock_response(self):
        """Mock Bedrock API response"""
        return {
            "output": {
                "message": {
                    "content": [
                        {"text": "Hello! I'd be happy to help you create an invoice."}
                    ]
                }
            },
            "stopReason": "end_turn",
            "usage": {
                "inputTokens": 100,
                "outputTokens": 50
            }
        }

    @pytest.fixture
    def mock_bedrock_invoice_response(self):
        """Mock Bedrock response with invoice data"""
        invoice_json = {
            "action": "create_invoice",
            "data": {
                "customer_name": "Acme Corp",
                "customer_email": "billing@acme.com",
                "invoice_date": "2024-01-15",
                "due_date": "2024-02-15",
                "line_items": [
                    {
                        "description": "Consulting Services",
                        "quantity": "10",
                        "unit_price": "150.00"
                    }
                ],
                "tax_rate": "0.08",
                "discount": "0",
                "notes": "Payment due within 30 days"
            }
        }

        return {
            "output": {
                "message": {
                    "content": [
                        {"text": json.dumps(invoice_json)}
                    ]
                }
            },
            "stopReason": "end_turn",
            "usage": {
                "inputTokens": 500,
                "outputTokens": 200
            }
        }

    def test_converse_success(self, bedrock_client, mock_bedrock_response):
        """Test successful conversation with Bedrock"""
        with patch.object(bedrock_client.bedrock_runtime, 'converse', return_value=mock_bedrock_response):
            messages = [Message(role="user", content="Hello")]
            response = bedrock_client.converse(messages)

            assert response.content == "Hello! I'd be happy to help you create an invoice."
            assert response.stop_reason == "end_turn"
            assert response.usage["inputTokens"] == 100
            assert response.usage["outputTokens"] == 50

    def test_converse_with_system_prompt(self, bedrock_client, mock_bedrock_response):
        """Test conversation with system prompt"""
        with patch.object(bedrock_client.bedrock_runtime, 'converse', return_value=mock_bedrock_response) as mock_converse:
            messages = [Message(role="user", content="Create invoice")]
            response = bedrock_client.converse(
                messages,
                system_prompt="You are an invoice assistant"
            )

            # Verify system prompt was included
            call_args = mock_converse.call_args[1]
            assert 'system' in call_args
            assert call_args['system'][0]['text'] == "You are an invoice assistant"

    def test_converse_api_error(self, bedrock_client):
        """Test handling of Bedrock API errors"""
        from botocore.exceptions import ClientError

        error_response = {'Error': {'Code': 'ThrottlingException', 'Message': 'Rate exceeded'}}
        with patch.object(
            bedrock_client.bedrock_runtime,
            'converse',
            side_effect=ClientError(error_response, 'converse')
        ):
            messages = [Message(role="user", content="Hello")]

            with pytest.raises(BedrockException) as exc_info:
                bedrock_client.converse(messages)

            assert "Bedrock API error" in str(exc_info.value)

    def test_process_conversation_turn(self, bedrock_client, mock_bedrock_response):
        """Test processing a conversation turn"""
        conversation = Conversation(user_id="test-user-123")

        with patch.object(bedrock_client.bedrock_runtime, 'converse', return_value=mock_bedrock_response):
            response, extracted_data = bedrock_client.process_conversation_turn(
                conversation,
                "I need to create an invoice"
            )

            assert response == "Hello! I'd be happy to help you create an invoice."
            assert extracted_data is None  # No structured data in this response
            assert len(conversation.messages) == 2  # User + assistant

    def test_extract_json_from_response(self, bedrock_client):
        """Test JSON extraction from model response"""
        # Test plain JSON
        json_response = '{"action": "create_invoice", "data": {}}'
        extracted = bedrock_client._extract_json_from_response(json_response)
        assert extracted is not None
        assert extracted["action"] == "create_invoice"

        # Test JSON in markdown code block
        markdown_response = '```json\n{"action": "cancel"}\n```'
        extracted = bedrock_client._extract_json_from_response(markdown_response)
        assert extracted is not None
        assert extracted["action"] == "cancel"

        # Test non-JSON response
        text_response = "This is just a regular text response"
        extracted = bedrock_client._extract_json_from_response(text_response)
        assert extracted is None

    def test_validate_and_parse_invoice_data(self, bedrock_client):
        """Test invoice data validation and parsing"""
        invoice_dict = {
            "action": "create_invoice",
            "data": {
                "customer_name": "Test Customer",
                "invoice_date": "2024-01-15",
                "due_date": "2024-02-15",
                "line_items": [
                    {
                        "description": "Service A",
                        "quantity": "5",
                        "unit_price": "100.00"
                    }
                ],
                "tax_rate": "0.08",
                "discount": "50.00"
            }
        }

        invoice_data = bedrock_client.validate_and_parse_invoice_data(invoice_dict)

        assert isinstance(invoice_data, InvoiceData)
        assert invoice_data.customer_name == "Test Customer"
        assert len(invoice_data.line_items) == 1
        assert invoice_data.line_items[0].quantity == Decimal("5")
        assert invoice_data.tax_rate == Decimal("0.08")
        assert invoice_data.subtotal == Decimal("500.00")
        assert invoice_data.total == Decimal("486.00")  # (500 - 50) * 1.08

    def test_validate_invalid_invoice_data(self, bedrock_client):
        """Test validation of invalid invoice data"""
        # Missing required field
        invalid_data = {
            "action": "create_invoice",
            "data": {
                "customer_name": "Test",
                # Missing due_date
                "line_items": []
            }
        }

        with pytest.raises(ValueError) as exc_info:
            bedrock_client.validate_and_parse_invoice_data(invalid_data)

        assert "Missing required field" in str(exc_info.value) or "field required" in str(exc_info.value).lower()

    def test_generate_invoice_summary(self, bedrock_client):
        """Test invoice summary generation"""
        invoice_data = InvoiceData(
            customer_name="Acme Corp",
            invoice_date=date(2024, 1, 15),
            due_date=date(2024, 2, 15),
            line_items=[
                LineItem(description="Item 1", quantity=Decimal("2"), unit_price=Decimal("100")),
                LineItem(description="Item 2", quantity=Decimal("1"), unit_price=Decimal("50"))
            ],
            tax_rate=Decimal("0.1")
        )

        summary = bedrock_client.generate_invoice_summary(invoice_data)

        assert "Acme Corp" in summary
        assert "Item 1" in summary
        assert "Item 2" in summary
        assert "$250" in summary  # Subtotal
        assert "$275" in summary  # Total with 10% tax

    def test_process_conversation_with_invoice_extraction(self, bedrock_client, mock_bedrock_invoice_response):
        """Test full conversation turn with invoice data extraction"""
        conversation = Conversation(user_id="test-user")

        with patch.object(bedrock_client.bedrock_runtime, 'converse', return_value=mock_bedrock_invoice_response):
            response, extracted_data = bedrock_client.process_conversation_turn(
                conversation,
                "Yes, create the invoice"
            )

            assert extracted_data is not None
            assert extracted_data["action"] == "create_invoice"
            assert extracted_data["data"]["customer_name"] == "Acme Corp"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
