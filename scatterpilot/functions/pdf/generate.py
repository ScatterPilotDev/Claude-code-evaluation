"""
Lambda function: Generate PDF
Generates a professional PDF invoice from invoice data with tier-based styling
Includes QR code payment links for Pro users with connected Stripe accounts
"""

import io
import os
import sys
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

# Add layer to path
sys.path.insert(0, '/opt/python')

import boto3
import qrcode
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
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
        self.styles.add(ParagraphStyle(
            name='PaymentHeading',
            parent=self.styles['Heading2'],
            fontSize=14,
            fontName='Helvetica-Bold',
            textColor=self.color_palette['primary'],
            alignment=TA_CENTER,
            spaceAfter=12
        ))
        self.styles.add(ParagraphStyle(
            name='PaymentLink',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=self.color_palette['accent'],
            alignment=TA_CENTER,
            spaceBefore=8
        ))

    def generate_qr_code(self, url: str, size_inches: float = 2.0) -> Image:
        """
        Generate a QR code image for the given URL

        Args:
            url: The URL to encode in the QR code
            size_inches: Size of the QR code in inches (default 2.0)

        Returns:
            ReportLab Image object ready to be added to the PDF
        """
        # Create QR code with high error correction for better scanning
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=2,
        )
        qr.add_data(url)
        qr.make(fit=True)

        # Create PIL image
        qr_image = qr.make_image(fill_color="black", back_color="white")

        # Convert to bytes for ReportLab
        img_buffer = io.BytesIO()
        qr_image.save(img_buffer, format='PNG')
        img_buffer.seek(0)

        # Create ReportLab Image with specified size
        size_points = size_inches * inch
        return Image(img_buffer, width=size_points, height=size_points)

    def generate(
        self,
        invoice_data: Dict[str, Any],
        invoice_id: str = None,
        payment_link_url: Optional[str] = None
    ) -> bytes:
        """
        Generate PDF from invoice data — clean premium design with generous whitespace.

        Args:
            invoice_data: Invoice data dictionary
            invoice_id: Invoice ID for generating invoice number if needed
            payment_link_url: Optional Stripe payment link URL for QR code

        Returns:
            PDF bytes
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=0.9 * inch,
            leftMargin=0.9 * inch,
            topMargin=0.85 * inch,
            bottomMargin=0.85 * inch
        )

        story = []

        # ------------------------------------------------------------------
        # Resolve invoice number
        # ------------------------------------------------------------------
        invoice_num = invoice_data.get("invoice_number")
        if not invoice_num or invoice_num == "None":
            invoice_num = invoice_id[-8:].upper() if invoice_id else "N/A"

        # ------------------------------------------------------------------
        # Format dates
        # ------------------------------------------------------------------
        def fmt_date(raw):
            if isinstance(raw, str) and len(raw) == 10:
                try:
                    return datetime.strptime(raw, '%Y-%m-%d').strftime('%B %d, %Y')
                except Exception:
                    pass
            return raw or ''

        invoice_date = fmt_date(invoice_data.get('invoice_date', datetime.now().strftime('%Y-%m-%d')))
        due_date = fmt_date(invoice_data.get('due_date', ''))

        # ------------------------------------------------------------------
        # PAGE WIDTH (usable)
        # ------------------------------------------------------------------
        page_width = letter[0] - 1.8 * inch  # left + right margins

        # ------------------------------------------------------------------
        # HEADER: large INVOICE heading + invoice number
        # ------------------------------------------------------------------
        business_name = self.user_info.get('business_name', '')

        invoice_label_style = ParagraphStyle(
            'InvoiceLabel',
            parent=self.styles['Normal'],
            fontSize=36,
            fontName='Helvetica-Bold',
            textColor=self.color_palette['primary'],
            leading=40,
        )
        invoice_num_style = ParagraphStyle(
            'InvoiceNum',
            parent=self.styles['Normal'],
            fontSize=10,
            fontName='Helvetica',
            textColor=self.color_palette['text_light'],
            alignment=TA_RIGHT,
            leading=14,
        )

        if business_name:
            biz_style = ParagraphStyle(
                'BizName',
                parent=self.styles['Normal'],
                fontSize=13,
                fontName='Helvetica-Bold',
                textColor=self.color_palette['text'],
                leading=16,
            )
            top_left = [
                Paragraph('INVOICE', invoice_label_style),
                Paragraph(business_name, biz_style),
            ]
        else:
            top_left = [Paragraph('INVOICE', invoice_label_style)]

        top_right_content = Paragraph(
            f'<b>#{invoice_num}</b><br/>'
            f'<font color="#718096">Date: {invoice_date}</font><br/>'
            f'<font color="#718096">Due: {due_date}</font>',
            invoice_num_style
        )

        header_table = Table(
            [[top_left, top_right_content]],
            colWidths=[page_width * 0.55, page_width * 0.45]
        )
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
        ]))
        story.append(header_table)

        # Thick accent rule below header
        rule_table = Table([[''] * 1], colWidths=[page_width])
        rule_table.setStyle(TableStyle([
            ('LINEBELOW', (0, 0), (-1, 0), 3, self.color_palette['primary']),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        story.append(rule_table)
        story.append(Spacer(1, 0.4 * inch))

        # ------------------------------------------------------------------
        # FROM / BILL TO  — two-column info block
        # ------------------------------------------------------------------
        label_style = ParagraphStyle(
            'InfoLabel',
            parent=self.styles['Normal'],
            fontSize=8,
            fontName='Helvetica-Bold',
            textColor=self.color_palette['text_light'],
            spaceAfter=3,
            leading=10,
        )
        info_style = ParagraphStyle(
            'InfoText',
            parent=self.styles['Normal'],
            fontSize=10,
            fontName='Helvetica',
            textColor=self.color_palette['text'],
            leading=14,
        )

        # FROM column (user / sender)
        from_parts = []
        if self.user_info.get('name'):
            from_parts.append(str(self.user_info['name']))
        if self.user_info.get('phone'):
            from_parts.append(str(self.user_info['phone']))
        if self.user_info.get('email'):
            from_parts.append(str(self.user_info['email']))
        if self.user_info.get('address'):
            from_parts.append(str(self.user_info['address']))

        from_col = [Paragraph('FROM', label_style)]
        if from_parts:
            from_col.append(Paragraph('<br/>'.join(from_parts), info_style))
        else:
            from_col.append(Paragraph('—', info_style))

        # BILL TO column (customer)
        bill_parts = [f'<b>{invoice_data["customer_name"]}</b>']
        if invoice_data.get('customer_email'):
            bill_parts.append(invoice_data['customer_email'])
        if invoice_data.get('customer_phone'):
            bill_parts.append(invoice_data['customer_phone'])
        if invoice_data.get('customer_address'):
            bill_parts.append(invoice_data['customer_address'])

        bill_col = [
            Paragraph('BILL TO', label_style),
            Paragraph('<br/>'.join(bill_parts), info_style),
        ]

        info_table = Table(
            [[from_col, bill_col]],
            colWidths=[page_width * 0.48, page_width * 0.52]
        )
        info_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 0.45 * inch))

        # ------------------------------------------------------------------
        # LINE ITEMS TABLE
        # ------------------------------------------------------------------
        line_items_data = [['QTY', 'DESCRIPTION', 'UNIT PRICE', 'AMOUNT']]

        for item in invoice_data['line_items']:
            line_items_data.append([
                str(item['quantity']),
                item['description'],
                f"${float(item['unit_price']):,.2f}",
                f"${float(item['total']):,.2f}"
            ])

        col_widths = [0.55 * inch, page_width - 0.55 * inch - 1.25 * inch - 1.2 * inch, 1.25 * inch, 1.2 * inch]
        line_items_table = Table(line_items_data, colWidths=col_widths)

        table_style_commands = [
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), self.color_palette['table_header']),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 9),
            ('TOPPADDING', (0, 0), (-1, 0), 9),
            ('LEFTPADDING', (0, 0), (-1, 0), 8),
            ('RIGHTPADDING', (0, 0), (-1, 0), 8),

            # Body rows
            ('ALIGN', (0, 1), (0, -1), 'CENTER'),   # QTY center
            ('ALIGN', (1, 1), (1, -1), 'LEFT'),     # Description left
            ('ALIGN', (2, 1), (-1, -1), 'RIGHT'),   # Prices right
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('TOPPADDING', (0, 1), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 10),
            ('LEFTPADDING', (0, 1), (-1, -1), 8),
            ('RIGHTPADDING', (0, 1), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            # Subtle row separator only
            ('LINEBELOW', (0, 1), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ]

        # Alternating row tint
        for i in range(1, len(line_items_data)):
            if i % 2 == 0:
                table_style_commands.append(
                    ('BACKGROUND', (0, i), (-1, i), self.color_palette['table_alt_row'])
                )

        line_items_table.setStyle(TableStyle(table_style_commands))
        story.append(line_items_table)
        story.append(Spacer(1, 0.35 * inch))

        # ------------------------------------------------------------------
        # TOTALS — right-aligned stacked rows, then highlighted TOTAL box
        # ------------------------------------------------------------------
        subtotal = float(invoice_data['subtotal'])
        discount = float(invoice_data.get('discount', 0))
        tax_rate_percent = float(invoice_data['tax_rate']) * 100
        tax_amount = float(invoice_data['tax_amount'])
        total = float(invoice_data['total'])

        totals_rows = []
        totals_rows.append(['Subtotal', f"${subtotal:,.2f}"])
        if discount > 0:
            totals_rows.append(['Discount', f"-${discount:,.2f}"])
        totals_rows.append([f'Tax ({tax_rate_percent:.2f}%)', f"${tax_amount:,.2f}"])

        sub_totals_table = Table(totals_rows, colWidths=[1.6 * inch, 1.4 * inch], hAlign='RIGHT')
        sub_totals_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 0), (-1, -1), self.color_palette['text_light']),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(sub_totals_table)
        story.append(Spacer(1, 0.12 * inch))

        # Highlighted total box
        total_box_data = [[f'TOTAL DUE', f"${total:,.2f}"]]
        total_box_table = Table(total_box_data, colWidths=[1.6 * inch, 1.55 * inch], hAlign='RIGHT')
        total_box_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), self.color_palette['primary']),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (0, 0), 9),
            ('FONTSIZE', (1, 0), (1, 0), 14),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('ROUNDEDCORNERS', [4]),
        ]))
        story.append(total_box_table)

        # ------------------------------------------------------------------
        # NOTES
        # ------------------------------------------------------------------
        if invoice_data.get('notes'):
            story.append(Spacer(1, 0.45 * inch))
            story.append(Paragraph('NOTES', label_style))
            story.append(Spacer(1, 0.06 * inch))
            story.append(Paragraph(invoice_data['notes'], info_style))

        # ------------------------------------------------------------------
        # PAYMENT SECTION — QR code only when Stripe payment link provided
        # ------------------------------------------------------------------
        if payment_link_url:
            story.append(Spacer(1, 0.5 * inch))

            # Thin separator
            sep = Table([['']], colWidths=[page_width])
            sep.setStyle(TableStyle([
                ('LINEABOVE', (0, 0), (-1, 0), 0.75, colors.HexColor('#e2e8f0')),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ]))
            story.append(sep)
            story.append(Spacer(1, 0.3 * inch))

            pay_heading = Paragraph(
                '<b>Pay This Invoice</b>',
                self.styles['PaymentHeading']
            )
            story.append(pay_heading)

            try:
                qr_image = self.generate_qr_code(payment_link_url, size_inches=1.8)
                qr_table = Table([[qr_image]], colWidths=[page_width])
                qr_table.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (0, 0), 'CENTER'),
                    ('VALIGN', (0, 0), (0, 0), 'MIDDLE'),
                ]))
                story.append(qr_table)
            except Exception as qr_error:
                logger.warning("Failed to generate QR code", error=str(qr_error))

            story.append(Spacer(1, 0.12 * inch))
            story.append(Paragraph(
                '<font size="9" color="#718096">Scan to pay securely via Stripe</font>',
                self.styles['CenterAlign']
            ))

            display_url = payment_link_url if len(payment_link_url) <= 60 else payment_link_url[:57] + '...'
            story.append(Spacer(1, 0.08 * inch))
            story.append(Paragraph(
                f'<link href="{payment_link_url}"><font size="9" color="{self.color_palette["accent"]}">{display_url}</font></link>',
                self.styles['CenterAlign']
            ))

        # ------------------------------------------------------------------
        # FOOTER — "Powered by ScatterPilot" (always visible, small & muted)
        # ------------------------------------------------------------------
        story.append(Spacer(1, 0.5 * inch))
        story.append(Paragraph(
            '<font size="7" color="#a0aec0">Powered by ScatterPilot</font>',
            self.styles['CenterAlign']
        ))

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

        # Get payment link URL if it exists (Pro users with Stripe connected)
        # This is stored directly in DynamoDB, not in the Invoice model
        payment_link_url = None
        if is_pro:
            try:
                invoices_table = os.environ.get('INVOICES_TABLE', 'ScatterPilot-Invoices-dev')
                dynamodb = boto3.resource('dynamodb')
                table = dynamodb.Table(invoices_table)
                raw_invoice = table.get_item(
                    Key={'invoice_id': invoice_id},
                    ProjectionExpression='payment_link_url'
                )
                payment_link_url = raw_invoice.get('Item', {}).get('payment_link_url')
                if payment_link_url:
                    logger.info("Payment link found for invoice", invoice_id=invoice_id)
            except Exception as pl_error:
                logger.warning(
                    "Failed to fetch payment link URL",
                    error=str(pl_error),
                    invoice_id=invoice_id
                )

        logger.info(
            "Generating PDF with tier-based styling",
            invoice_id=invoice_id,
            is_pro=is_pro,
            color_preference=color_preference,
            has_payment_link=bool(payment_link_url)
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
        pdf_bytes = pdf_generator.generate(
            invoice.data.to_dynamodb(),
            invoice_id=invoice_id,
            payment_link_url=payment_link_url
        )

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
