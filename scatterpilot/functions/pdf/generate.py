"""
Lambda function: Generate PDF
Generates a professional PDF invoice from invoice data with tier-based styling
"""

import io
import os
import sys
from datetime import datetime
from typing import Any, Dict, Tuple

# Add layer to path
sys.path.insert(0, '/opt/python')

import boto3
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT

from common.dynamodb_helper import DynamoDBHelper, DynamoDBException
from common.models import InvoiceStatus
from common.security import (
    extract_user_id_from_event,
    validate_uuid,
    create_error_response,
    create_success_response,
    InputValidationError
)
from common.logger import get_logger

logger = get_logger("generate_pdf")


# =============================================================================
# COLOR PALETTES - Tier-based styling
# =============================================================================

# FREE TIER - Grayscale only
FREE_PALETTE = {
    'primary': colors.HexColor('#2d3748'),      # Dark gray
    'accent': colors.HexColor('#4a5568'),       # Medium gray
    'table_header': colors.HexColor('#1e293b'), # Dark gray for header
    'table_alt_row': colors.HexColor('#f7fafc'),# Light gray for alternating rows
    'text': colors.HexColor('#1a202c'),         # Almost black
    'text_light': colors.HexColor('#718096')    # Light gray text
}

# PRO TIER - Color options
PRO_PALETTES = {
    'purple': {
        'primary': colors.HexColor('#6B46C1'),
        'accent': colors.HexColor('#553C9A'),
        'table_header': colors.HexColor('#6B46C1'),
        'table_alt_row': colors.HexColor('#FAF5FF'),
        'text': colors.HexColor('#1a202c'),
        'text_light': colors.HexColor('#718096')
    },
    'blue': {
        'primary': colors.HexColor('#3B82F6'),
        'accent': colors.HexColor('#2563EB'),
        'table_header': colors.HexColor('#3B82F6'),
        'table_alt_row': colors.HexColor('#EFF6FF'),
        'text': colors.HexColor('#1a202c'),
        'text_light': colors.HexColor('#718096')
    },
    'green': {
        'primary': colors.HexColor('#10B981'),
        'accent': colors.HexColor('#059669'),
        'table_header': colors.HexColor('#10B981'),
        'table_alt_row': colors.HexColor('#ECFDF5'),
        'text': colors.HexColor('#1a202c'),
        'text_light': colors.HexColor('#718096')
    },
    'orange': {
        'primary': colors.HexColor('#F59E0B'),
        'accent': colors.HexColor('#D97706'),
        'table_header': colors.HexColor('#F59E0B'),
        'table_alt_row': colors.HexColor('#FFFBEB'),
        'text': colors.HexColor('#1a202c'),
        'text_light': colors.HexColor('#718096')
    },
    'red': {
        'primary': colors.HexColor('#EF4444'),
        'accent': colors.HexColor('#DC2626'),
        'table_header': colors.HexColor('#EF4444'),
        'table_alt_row': colors.HexColor('#FEF2F2'),
        'text': colors.HexColor('#1a202c'),
        'text_light': colors.HexColor('#718096')
    }
}

logger = get_logger("generate_pdf")


class PDFGenerator:
    """PDF invoice generator using ReportLab with tier-based styling"""

    def __init__(self, color_palette: Dict[str, Any], is_free_tier: bool = False, user_info: Dict[str, Any] = None):
        """
        Initialize PDF generator with color palette and user info

        Args:
            color_palette: Dictionary of colors for the invoice
            is_free_tier: Whether this is a free tier user (for watermark)
            user_info: Dictionary containing user contact information
        """
        self.color_palette = color_palette
        self.is_free_tier = is_free_tier
        self.user_info = user_info or {}
        self.styles = getSampleStyleSheet()
        self.setup_custom_styles()

    def setup_custom_styles(self):
        """Create custom paragraph styles"""
        self.styles.add(ParagraphStyle(
            name='RightAlign',
            parent=self.styles['Normal'],
            alignment=TA_RIGHT
        ))
        self.styles.add(ParagraphStyle(
            name='CenterAlign',
            parent=self.styles['Normal'],
            alignment=TA_CENTER
        ))
        self.styles.add(ParagraphStyle(
            name='LeftAlign',
            parent=self.styles['Normal'],
            alignment=TA_LEFT
        ))
        self.styles.add(ParagraphStyle(
            name='CompanyName',
            parent=self.styles['Title'],
            fontSize=24,
            textColor=self.color_palette['primary'],
            spaceAfter=6,
            alignment=TA_LEFT
        ))
        self.styles.add(ParagraphStyle(
            name='SectionHeading',
            parent=self.styles['Normal'],
            fontSize=11,
            fontName='Helvetica-Bold',
            textColor=self.color_palette['text'],
            spaceAfter=6
        ))
        self.styles.add(ParagraphStyle(
            name='SmallText',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=self.color_palette['text_light']
        ))

    def generate(self, invoice_data: Dict[str, Any], invoice_id: str = None) -> bytes:
        """
        Generate PDF from invoice data using MAYROD template design

        Args:
            invoice_data: Invoice data dictionary
            invoice_id: Invoice ID for generating invoice number if needed

        Returns:
            PDF bytes
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=inch,
            leftMargin=inch,
            topMargin=inch,
            bottomMargin=inch
        )

        # Build PDF content
        story = []

        # =================================================================
        # HEADER SECTION
        # =================================================================

        # Company name and user info side-by-side
        # Handle invoice number - never show "None"
        invoice_num = invoice_data.get("invoice_number")
        if not invoice_num or invoice_num == "None":
            # Generate from invoice_id last 8 chars if available
            if invoice_id:
                invoice_num = invoice_id[-8:].upper()
            else:
                invoice_num = "N/A"

        # Tier-based header:
        # - Free tier: Always "INVOICE" (no customization)
        # - Pro tier: business_name from profile, or "INVOICE" if not set (optional customization)
        business_name = self.user_info.get('business_name', 'INVOICE')
        header_data = [
            [
                Paragraph(f'<b>{business_name}</b>', self.styles['CompanyName']),
                Paragraph(f'<b>INVOICE # {invoice_num}</b>', self.styles['RightAlign'])
            ]
        ]

        # User contact information (displayed for all tiers - Free and Pro)
        # CRITICAL: No "ScatterPilot" branding in header - only user's contact info
        user_contact_parts = []
        if self.user_info.get('name'):
            user_contact_parts.append(str(self.user_info['name']))
        if self.user_info.get('phone'):
            user_contact_parts.append(str(self.user_info['phone']))
        if self.user_info.get('email'):
            user_contact_parts.append(str(self.user_info['email']))
        if self.user_info.get('address'):
            user_contact_parts.append(str(self.user_info['address']))

        # If no contact info provided, show nothing (no fallback to ScatterPilot)
        user_contact_text = '<br/>'.join(user_contact_parts) if user_contact_parts else ''

        invoice_date = invoice_data.get('invoice_date', datetime.now().strftime('%m.%d.%Y'))
        if isinstance(invoice_date, str) and len(invoice_date) == 10:  # ISO format
            try:
                date_obj = datetime.strptime(invoice_date, '%Y-%m-%d')
                invoice_date = date_obj.strftime('%m.%d.%Y')
            except:
                pass

        due_date = invoice_data.get('due_date', '')
        if isinstance(due_date, str) and len(due_date) == 10:  # ISO format
            try:
                date_obj = datetime.strptime(due_date, '%Y-%m-%d')
                due_date = date_obj.strftime('%m.%d.%Y')
            except:
                pass

        header_data.append([
            Paragraph(f'<font size="9">{user_contact_text}</font>', self.styles['LeftAlign']),
            Paragraph(f'<font size="9">Date: {invoice_date}<br/>Due Date: {due_date}</font>',
                     self.styles['RightAlign'])
        ])

        header_table = Table(header_data, colWidths=[3.5 * inch, 3 * inch])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ]))
        story.append(header_table)
        story.append(Spacer(1, 0.4 * inch))

        # =================================================================
        # CLIENT INFO SECTION
        # =================================================================

        client_info_parts = [f"<b>To:</b> {invoice_data['customer_name']}"]
        if invoice_data.get('customer_email'):
            client_info_parts.append(invoice_data['customer_email'])
        if invoice_data.get('customer_phone'):
            client_info_parts.append(invoice_data['customer_phone'])
        if invoice_data.get('customer_address'):
            client_info_parts.append(invoice_data['customer_address'])

        client_info = Paragraph('<br/>'.join(client_info_parts), self.styles['Normal'])
        story.append(client_info)
        story.append(Spacer(1, 0.4 * inch))

        # =================================================================
        # LINE ITEMS TABLE
        # =================================================================

        line_items_data = [['Qty', 'Description', 'Unit Price', 'Line Total']]

        for item in invoice_data['line_items']:
            line_items_data.append([
                str(item['quantity']),
                item['description'],
                f"${float(item['unit_price']):,.2f}",
                f"${float(item['total']):,.2f}"
            ])

        line_items_table = Table(line_items_data, colWidths=[0.6 * inch, 3.3 * inch, 1.3 * inch, 1.3 * inch])

        # Build table style with alternating row colors
        table_style_commands = [
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), self.color_palette['table_header']),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('TOPPADDING', (0, 0), (-1, 0), 10),

            # Body rows
            ('ALIGN', (0, 1), (0, -1), 'CENTER'),  # Qty center
            ('ALIGN', (1, 1), (1, -1), 'LEFT'),    # Description left
            ('ALIGN', (2, 1), (-1, -1), 'RIGHT'),  # Prices right
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]

        # Add alternating row colors
        for i in range(1, len(line_items_data)):
            if i % 2 == 0:
                table_style_commands.append(
                    ('BACKGROUND', (0, i), (-1, i), self.color_palette['table_alt_row'])
                )

        line_items_table.setStyle(TableStyle(table_style_commands))
        story.append(line_items_table)
        story.append(Spacer(1, 0.3 * inch))

        # =================================================================
        # TOTALS SECTION
        # =================================================================

        totals_data = [
            ['Subtotal:', f"${float(invoice_data['subtotal']):,.2f}"],
        ]

        if float(invoice_data.get('discount', 0)) > 0:
            totals_data.append(['Discount:', f"-${float(invoice_data['discount']):,.2f}"])

        tax_rate_percent = float(invoice_data['tax_rate']) * 100
        totals_data.append([f'Sales Tax ({tax_rate_percent:.2f}%):', f"${float(invoice_data['tax_amount']):,.2f}"])
        totals_data.append(['Total:', f"${float(invoice_data['total']):,.2f}"])

        totals_table = Table(totals_data, colWidths=[1.8 * inch, 1.5 * inch], hAlign='RIGHT')
        totals_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, -2), 'Helvetica'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),  # Bold font for Total row
            ('FONTSIZE', (0, 0), (-1, -2), 10),
            ('FONTSIZE', (0, -1), (-1, -1), 12),
            ('LINEABOVE', (0, -1), (-1, -1), 1.5, self.color_palette['accent']),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(totals_table)

        # =================================================================
        # NOTES SECTION
        # =================================================================

        if invoice_data.get('notes'):
            story.append(Spacer(1, 0.4 * inch))
            notes_heading = Paragraph('<b>NOTES</b>', self.styles['SectionHeading'])
            story.append(notes_heading)
            notes = Paragraph(invoice_data['notes'], self.styles['Normal'])
            story.append(notes)

        # =================================================================
        # FOOTER SECTION (Tier-based watermark)
        # =================================================================

        story.append(Spacer(1, 0.5 * inch))

        # Free tier: Show watermark "Generated by ScatterPilot"
        # Pro tier: Clean professional footer (no watermark)
        if self.is_free_tier:
            footer_text = f'<font size="8" color="#718096">Generated by ScatterPilot on {datetime.now().strftime("%B %d, %Y at %I:%M %p")}</font>'
            footer = Paragraph(footer_text, self.styles['CenterAlign'])
            story.append(footer)
        # Pro tier: no watermark - clean professional look

        # Build PDF
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()

        return pdf_bytes


def get_user_info_from_cognito(event: Dict[str, Any], user_id: str = None, is_pro: bool = False) -> Dict[str, Any]:
    """
    Extract user information from Cognito claims and DynamoDB profile

    Tier-based logic:
    - Free tier: Contact info (name, phone, email, address) - NO business name
    - Pro tier: Contact info + optional business name

    Args:
        event: API Gateway event with authorizer context
        user_id: User identifier for fetching profile data
        is_pro: Whether user has Pro subscription

    Returns:
        Dictionary with user contact information
    """
    user_info = {}

    try:
        # Get claims from authorizer context
        authorizer = event.get('requestContext', {}).get('authorizer', {})
        claims = authorizer.get('claims', {})

        # Extract email from claims (available for all users)
        user_info['email'] = claims.get('email', '')

        # Fetch additional profile data from DynamoDB if user_id provided
        if user_id:
            try:
                db_helper = DynamoDBHelper()
                profile = db_helper.get_user_profile(user_id)

                if profile:
                    # Business name for header (PRO ONLY - this is the key differentiator)
                    if is_pro and profile.get('business_name'):
                        user_info['business_name'] = profile['business_name']

                    # Contact information (available for ALL users - Free and Pro)
                    if profile.get('contact_name'):
                        user_info['name'] = profile['contact_name']

                    if profile.get('phone'):
                        user_info['phone'] = profile['phone']

                    # Build address if any parts exist
                    address_parts = []
                    if profile.get('address_line1'):
                        address_parts.append(profile['address_line1'])
                    if profile.get('address_line2'):
                        address_parts.append(profile['address_line2'])

                    city_state_zip = []
                    if profile.get('city'):
                        city_state_zip.append(profile['city'])
                    if profile.get('state'):
                        city_state_zip.append(profile['state'])
                    if profile.get('zip_code'):
                        city_state_zip.append(profile['zip_code'])

                    if city_state_zip:
                        address_parts.append(', '.join(city_state_zip))

                    if profile.get('country') and profile['country'] != 'USA':
                        address_parts.append(profile['country'])

                    if address_parts:
                        user_info['address'] = '<br/>'.join(address_parts)

                    # Use profile email if available
                    if profile.get('email'):
                        user_info['email'] = profile['email']

            except Exception as profile_error:
                logger.warning("Failed to fetch user profile from DynamoDB", error=str(profile_error))

    except Exception as e:
        logger.warning("Failed to extract user info from Cognito", error=str(e))

    return user_info


def get_color_palette(is_pro: bool, color_preference: str = None) -> Dict[str, Any]:
    """
    Get the appropriate color palette based on subscription tier and preference

    Args:
        is_pro: Whether user has Pro subscription
        color_preference: User's color preference (purple, blue, green, orange, red)

    Returns:
        Color palette dictionary
    """
    if not is_pro:
        return FREE_PALETTE

    # Pro tier - use color preference or default to purple
    color_key = color_preference if color_preference in PRO_PALETTES else 'purple'
    return PRO_PALETTES[color_key]


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for PDF generation with tier-based styling

    Path parameters:
    - invoice_id: Invoice identifier

    Returns:
        API Gateway response with S3 URL to PDF
    """
    logger.log_lambda_invocation(event, context)
    request_id = context.aws_request_id if context else "local"
    logger.set_correlation_id(request_id)

    try:
        # Extract user ID
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        # Get invoice ID from path parameters
        path_params = event.get('pathParameters') or {}
        invoice_id = path_params.get('invoice_id')

        if not invoice_id:
            return create_error_response(400, "Invoice ID is required", "ValidationError")

        # Validate UUID format
        try:
            invoice_id = validate_uuid(invoice_id, "Invoice ID")
        except InputValidationError as e:
            return create_error_response(400, str(e), "ValidationError")

        # Retrieve invoice from database
        db_helper = DynamoDBHelper()
        invoice = db_helper.get_invoice(invoice_id)

        if not invoice:
            return create_error_response(404, "Invoice not found", "NotFound")

        # Verify ownership
        if invoice.user_id != user_id:
            return create_error_response(403, "Not authorized", "Forbidden")

        # Get user subscription to determine tier and color preference
        # Use try-except to handle subscription lookup failures gracefully
        subscription = None
        is_pro = False
        color_preference = None

        try:
            subscription = db_helper.get_user_subscription(user_id)
            is_pro = subscription and subscription.get('subscription_status') == 'pro'
            color_preference = subscription.get('invoice_color') if subscription else None
        except Exception as sub_error:
            logger.warning(
                "Failed to get subscription, defaulting to free tier",
                error=str(sub_error)
            )
            # Default to free tier if subscription lookup fails
            is_pro = False
            color_preference = None

        logger.info(
            "Generating PDF with tier-based styling",
            invoice_id=invoice_id,
            is_pro=is_pro,
            color_preference=color_preference
        )

        # Get user info from Cognito and DynamoDB profile (safe - returns empty dict on failure)
        # Tier-based: Free users don't get profile data, Pro users get optional customization
        user_info = get_user_info_from_cognito(event, user_id, is_pro=is_pro)

        # Get appropriate color palette
        color_palette = get_color_palette(is_pro, color_preference)

        # Generate PDF with tier-based styling
        pdf_generator = PDFGenerator(
            color_palette=color_palette,
            is_free_tier=not is_pro,
            user_info=user_info
        )
        pdf_bytes = pdf_generator.generate(invoice.data.to_dynamodb(), invoice_id=invoice_id)

        # Upload to S3
        s3_bucket = os.environ.get('INVOICE_BUCKET', 'scatterpilot-invoices')
        s3_key = f"invoices/{user_id}/{invoice_id}.pdf"

        s3_client = boto3.client('s3')
        s3_client.put_object(
            Bucket=s3_bucket,
            Key=s3_key,
            Body=pdf_bytes,
            ContentType='application/pdf',
            ServerSideEncryption='AES256'
            # NOTE: Public access controlled by bucket policy, not object ACLs
        )

        logger.info("PDF uploaded to S3", s3_bucket=s3_bucket, s3_key=s3_key)

        # Update invoice record with PDF location
        db_helper.update_invoice_status(
            invoice_id=invoice_id,
            status=InvoiceStatus.PENDING,
            pdf_s3_key=s3_key
        )

        # Generate direct S3 URL (rollback to working version)
        # NOTE: Exposes AWS account ID but ensures functionality
        # Secure download endpoint can be re-implemented later after proper testing
        download_url = f"https://{s3_bucket}.s3.amazonaws.com/{s3_key}"

        logger.info(f"PDF URL generated: {download_url}")

        response_data = {
            "invoice_id": invoice_id,
            "pdf_generated": True,
            "download_url": download_url,
            "status": "completed",
            "s3_location": {
                "bucket": s3_bucket,
                "key": s3_key
            }
        }

        logger.info("PDF generation completed", invoice_id=invoice_id)

        return create_success_response(response_data)

    except InputValidationError as e:
        logger.warning("Input validation error", error=e)
        return create_error_response(400, str(e), "ValidationError")

    except DynamoDBException as e:
        logger.error("Database error", error=e)
        return create_error_response(500, "Database error occurred", "DatabaseError")

    except Exception as e:
        logger.error("Unexpected error in PDF generation", error=e)
        return create_error_response(500, "Failed to generate PDF", "InternalError")
