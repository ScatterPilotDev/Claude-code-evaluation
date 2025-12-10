"""
Integration tests for conversation flow
Tests the end-to-end conversation and invoice creation process
"""

import pytest
from datetime import datetime, date
from decimal import Decimal
from unittest.mock import Mock, patch

from common.models import (
    Conversation, ConversationState, Message,
    Invoice, InvoiceData, InvoiceStatus, LineItem
)


class TestConversationFlow:
    """Test conversation state management and flow"""

    @pytest.fixture
    def conversation(self):
        """Create a test conversation"""
        return Conversation(user_id="test-user-123")

    def test_conversation_initialization(self, conversation):
        """Test conversation starts in correct state"""
        assert conversation.state == ConversationState.INITIATED
        assert len(conversation.messages) == 0
        assert conversation.user_id == "test-user-123"
        assert conversation.conversation_id is not None

    def test_add_message_to_conversation(self, conversation):
        """Test adding messages to conversation"""
        conversation.add_message(role="user", content="Hello")
        conversation.add_message(role="assistant", content="Hi there!")

        assert len(conversation.messages) == 2
        assert conversation.messages[0].role == "user"
        assert conversation.messages[0].content == "Hello"
        assert conversation.messages[1].role == "assistant"

    def test_conversation_message_timestamps(self, conversation):
        """Test that messages have timestamps"""
        before = datetime.utcnow()
        conversation.add_message(role="user", content="Test")
        after = datetime.utcnow()

        message = conversation.messages[0]
        assert before <= message.timestamp <= after

    def test_conversation_to_bedrock_format(self, conversation):
        """Test conversion to Bedrock API format"""
        conversation.add_message(role="user", content="Create invoice")
        conversation.add_message(role="assistant", content="Sure!")

        bedrock_messages = conversation.to_bedrock_messages()

        assert len(bedrock_messages) == 2
        assert bedrock_messages[0]["role"] == "user"
        assert bedrock_messages[0]["content"][0]["text"] == "Create invoice"

    def test_conversation_state_transitions(self, conversation):
        """Test conversation state transitions"""
        # Start in INITIATED
        assert conversation.state == ConversationState.INITIATED

        # Move to GATHERING_INFO
        conversation.state = ConversationState.GATHERING_INFO
        assert conversation.state == ConversationState.GATHERING_INFO

        # Complete
        conversation.state = ConversationState.COMPLETED
        assert conversation.state == ConversationState.COMPLETED


class TestInvoiceDataModel:
    """Test invoice data model validation"""

    def test_line_item_total_calculation(self):
        """Test line item total calculation"""
        item = LineItem(
            description="Consulting",
            quantity=Decimal("10"),
            unit_price=Decimal("150.50")
        )

        assert item.total == Decimal("1505.00")

    def test_invoice_subtotal_calculation(self):
        """Test invoice subtotal calculation"""
        invoice_data = InvoiceData(
            customer_name="Test Corp",
            invoice_date=date(2024, 1, 1),
            due_date=date(2024, 2, 1),
            line_items=[
                LineItem(description="Item 1", quantity=Decimal("2"), unit_price=Decimal("100")),
                LineItem(description="Item 2", quantity=Decimal("3"), unit_price=Decimal("50"))
            ]
        )

        assert invoice_data.subtotal == Decimal("350.00")

    def test_invoice_tax_calculation(self):
        """Test tax calculation"""
        invoice_data = InvoiceData(
            customer_name="Test Corp",
            invoice_date=date(2024, 1, 1),
            due_date=date(2024, 2, 1),
            line_items=[
                LineItem(description="Item", quantity=Decimal("1"), unit_price=Decimal("100"))
            ],
            tax_rate=Decimal("0.08")
        )

        assert invoice_data.tax_amount == Decimal("8.00")

    def test_invoice_total_with_discount(self):
        """Test total calculation with discount"""
        invoice_data = InvoiceData(
            customer_name="Test Corp",
            invoice_date=date(2024, 1, 1),
            due_date=date(2024, 2, 1),
            line_items=[
                LineItem(description="Item", quantity=Decimal("1"), unit_price=Decimal("100"))
            ],
            tax_rate=Decimal("0.1"),
            discount=Decimal("10")
        )

        # Subtotal: 100, Discount: 10, Taxable: 90, Tax: 9, Total: 99
        assert invoice_data.subtotal == Decimal("100.00")
        assert invoice_data.tax_amount == Decimal("9.00")
        assert invoice_data.total == Decimal("99.00")

    def test_due_date_validation(self):
        """Test due date must be after invoice date"""
        with pytest.raises(ValueError) as exc_info:
            InvoiceData(
                customer_name="Test",
                invoice_date=date(2024, 2, 1),
                due_date=date(2024, 1, 1),  # Before invoice date
                line_items=[
                    LineItem(description="Item", quantity=Decimal("1"), unit_price=Decimal("100"))
                ]
            )

        assert "Due date cannot be before invoice date" in str(exc_info.value)

    def test_invoice_to_dynamodb_format(self):
        """Test conversion to DynamoDB format"""
        invoice_data = InvoiceData(
            customer_name="Test Corp",
            invoice_date=date(2024, 1, 15),
            due_date=date(2024, 2, 15),
            line_items=[
                LineItem(description="Service", quantity=Decimal("5"), unit_price=Decimal("100"))
            ],
            tax_rate=Decimal("0.08")
        )

        db_format = invoice_data.to_dynamodb()

        assert db_format["customer_name"] == "Test Corp"
        assert db_format["invoice_date"] == "2024-01-15"
        assert db_format["due_date"] == "2024-02-15"
        assert len(db_format["line_items"]) == 1
        assert db_format["subtotal"] == "500"
        # Check that total is 540.00 (500 * 1.08), allowing for decimal precision
        assert Decimal(db_format["total"]) == Decimal("540.00")


class TestInvoiceModel:
    """Test invoice model"""

    def test_invoice_creation(self):
        """Test creating an invoice"""
        invoice_data = InvoiceData(
            customer_name="Test",
            invoice_date=date(2024, 1, 1),
            due_date=date(2024, 2, 1),
            line_items=[
                LineItem(description="Item", quantity=Decimal("1"), unit_price=Decimal("100"))
            ]
        )

        invoice = Invoice(
            user_id="user-123",
            data=invoice_data,
            status=InvoiceStatus.DRAFT
        )

        assert invoice.user_id == "user-123"
        assert invoice.status == InvoiceStatus.DRAFT
        assert invoice.invoice_id is not None
        assert invoice.pdf_s3_key is None

    def test_invoice_status_values(self):
        """Test invoice status enum values"""
        assert InvoiceStatus.DRAFT.value == "draft"
        assert InvoiceStatus.PENDING.value == "pending"
        assert InvoiceStatus.PAID.value == "paid"
        assert InvoiceStatus.CANCELLED.value == "cancelled"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
