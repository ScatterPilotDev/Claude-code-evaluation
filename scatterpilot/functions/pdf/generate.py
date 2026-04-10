"""
Lambda function: Generate PDF
Generates a premium-design invoice PDF from invoice data.
Uses ReportLab with A4 layout, sage colour system, overdue banner,
QR code payment link, and a pinned footer via onPage callback.
"""

import io
import os
import sys
from datetime import datetime
from typing import Any, Dict, Optional

sys.path.insert(0, '/opt/python')

import boto3
import qrcode
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, inch
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, HRFlowable
)
from reportlab.graphics.shapes import Drawing, Rect as GRect
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT

from common.dynamodb_helper import DynamoDBHelper, DynamoDBException
from common.models import InvoiceStatus
from common.security import (
    extract_user_id_from_event,
    validate_uuid,
    create_error_response,
    create_success_response,
    InputValidationError,
)
from common.logger import get_logger

logger = get_logger("generate_pdf")

# =============================================================================
# SAGE DESIGN SYSTEM — shared across all tiers, primary colour varies by pref
# =============================================================================

SAGE_DESIGN = {
    # Invariant tokens — same for every invoice
    'table_header_bg':   colors.HexColor('#F4F7F3'),  # sage light
    'table_alt_row':     colors.HexColor('#F9FAF9'),  # very subtle tint
    'text':              colors.HexColor('#1A2318'),  # text-primary
    'text_secondary':    colors.HexColor('#5F6B5A'),  # text-secondary
    'border':            colors.HexColor('#E2E5DE'),  # surface-border
    'danger':            colors.HexColor('#C2412D'),  # danger
    'danger_light':      colors.HexColor('#FEF2F1'),  # danger-50
    'amount_due_bg':     colors.HexColor('#F4F7F3'),  # sage light
    'white':             colors.white,
}

# Free tier — sage as primary
FREE_PALETTE = {**SAGE_DESIGN, 'primary': colors.HexColor('#4A6741'), 'accent': colors.HexColor('#3D5835')}

# Pro palettes — primary/accent vary; layout tokens stay the same
PRO_PALETTES = {
    'sage': {**SAGE_DESIGN,   'primary': colors.HexColor('#4A6741'), 'accent': colors.HexColor('#3D5835')},
    'purple': {**SAGE_DESIGN, 'primary': colors.HexColor('#6B46C1'), 'accent': colors.HexColor('#553C9A')},
    'blue':   {**SAGE_DESIGN, 'primary': colors.HexColor('#2563EB'), 'accent': colors.HexColor('#1D4ED8')},
    'green':  {**SAGE_DESIGN, 'primary': colors.HexColor('#059669'), 'accent': colors.HexColor('#047857')},
    'orange': {**SAGE_DESIGN, 'primary': colors.HexColor('#D97706'), 'accent': colors.HexColor('#B45309')},
    'red':    {**SAGE_DESIGN, 'primary': colors.HexColor('#DC2626'), 'accent': colors.HexColor('#B91C1C')},
}


def get_color_palette(is_pro: bool, color_preference: str = None) -> Dict[str, Any]:
    if not is_pro:
        return FREE_PALETTE
    key = color_preference if color_preference in PRO_PALETTES else 'sage'
    return PRO_PALETTES[key]


# =============================================================================
# PDF GENERATOR
# =============================================================================

class PDFGenerator:
    """Premium invoice PDF generator — A4, sage design system, ReportLab."""

    # A4 margins: 20 mm each side
    MARGIN = 20 * mm

    def __init__(
        self,
        color_palette: Dict[str, Any],
        is_free_tier: bool = False,
        user_info: Dict[str, Any] = None,
    ):
        self.p = color_palette          # palette shorthand
        self.is_free_tier = is_free_tier
        self.user_info = user_info or {}
        self.styles = getSampleStyleSheet()
        self._page_width = A4[0] - 2 * self.MARGIN   # usable width in points

    # ------------------------------------------------------------------
    # LOGO MARK
    # ------------------------------------------------------------------
    def _logo_mark(self, size_pt: float = 18.0) -> Drawing:
        """
        Return a ReportLab Drawing of the geometric 3-bar S-form logo mark.
        Matches the SVG favicon — sage-500 rounded square with white bars.
        """
        d = Drawing(size_pt, size_pt)
        s = size_pt / 32  # scale factor: SVG uses 32-unit grid

        # Background rounded square
        corner_r = size_pt * 0.22
        d.add(GRect(0, 0, size_pt, size_pt,
                    rx=corner_r, ry=corner_r,
                    fillColor=self.p['primary'],
                    strokeColor=None, strokeWidth=0))

        # Bar dimensions (scaled from 32-unit SVG)
        bar_w = 16 * s
        bar_h = 5 * s
        bar_rx = 2 * s
        white = colors.white

        # ReportLab y is bottom-up; SVG y is top-down.
        # SVG bar tops: 5.5, 13.5, 21.5  →  bottoms (in RL): size_pt - (top + bar_h) * s
        # Top bar (SVG x=10, y=5.5–10.5):
        d.add(GRect(10 * s, size_pt - 10.5 * s, bar_w, bar_h,
                    rx=bar_rx, ry=bar_rx,
                    fillColor=white, strokeColor=None, strokeWidth=0))
        # Mid bar (SVG x=6, y=13.5–18.5):
        d.add(GRect(6 * s, size_pt - 18.5 * s, bar_w, bar_h,
                    rx=bar_rx, ry=bar_rx,
                    fillColor=white, strokeColor=None, strokeWidth=0))
        # Bot bar (SVG x=10, y=21.5–26.5):
        d.add(GRect(10 * s, size_pt - 26.5 * s, bar_w, bar_h,
                    rx=bar_rx, ry=bar_rx,
                    fillColor=white, strokeColor=None, strokeWidth=0))
        return d

    # ------------------------------------------------------------------
    # QR CODE
    # ------------------------------------------------------------------
    def _qr_image(self, url: str, size_mm: float = 25.0) -> Image:
        """Return a ReportLab Image containing a QR code."""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=2,
        )
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image(fill_color='black', back_color='white')
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        size_pt = size_mm * mm
        return Image(buf, width=size_pt, height=size_pt)

    # ------------------------------------------------------------------
    # HELPERS
    # ------------------------------------------------------------------
    @staticmethod
    def _fmt_date(raw) -> str:
        if isinstance(raw, str) and len(raw) >= 10:
            try:
                return datetime.strptime(raw[:10], '%Y-%m-%d').strftime('%B %d, %Y')
            except Exception:
                pass
        return raw or '—'

    @staticmethod
    def _fmt_currency(amount) -> str:
        try:
            return f'${float(amount):,.2f}'
        except (TypeError, ValueError):
            return '$0.00'

    def _para(self, text: str, **kwargs) -> Paragraph:
        """Shorthand: make a Paragraph with inline style overrides."""
        style = ParagraphStyle('_inline', parent=self.styles['Normal'], **kwargs)
        return Paragraph(text, style)

    def _spacer(self, height_mm: float) -> Spacer:
        return Spacer(1, height_mm * mm)

    def _hr(self, color=None, thickness: float = 0.5) -> HRFlowable:
        return HRFlowable(
            width='100%',
            thickness=thickness,
            color=color or self.p['border'],
            spaceAfter=0,
            spaceBefore=0,
        )

    # ------------------------------------------------------------------
    # OVERDUE CHECK
    # ------------------------------------------------------------------
    @staticmethod
    def _is_overdue(invoice_data: Dict[str, Any], status: str) -> bool:
        if status in ('paid', 'cancelled'):
            return False
        due = invoice_data.get('due_date')
        if not due:
            return False
        try:
            return datetime.strptime(due[:10], '%Y-%m-%d').date() < datetime.utcnow().date()
        except Exception:
            return False

    # ------------------------------------------------------------------
    # MAIN GENERATE
    # ------------------------------------------------------------------
    def generate(
        self,
        invoice_data: Dict[str, Any],
        invoice_id: str = None,
        invoice_status: str = 'draft',
        payment_url: Optional[str] = None,
    ) -> bytes:
        """
        Build the PDF and return raw bytes.

        Args:
            invoice_data: Flat dict from invoice.data.to_dynamodb()
            invoice_id:   Invoice UUID (used to derive display number if absent)
            invoice_status: Invoice status string ('draft', 'paid', 'overdue', …)
            payment_url:  URL for the QR code / payment link (None → omit)
        """
        buf = io.BytesIO()
        W = self._page_width
        p = self.p  # colour palette

        # ── Derived values ────────────────────────────────────────────
        invoice_num = invoice_data.get('invoice_number') or ''
        if not invoice_num or invoice_num == 'None':
            invoice_num = (invoice_id[-8:].upper() if invoice_id else 'N/A')

        invoice_date_str = self._fmt_date(
            invoice_data.get('invoice_date', datetime.now().strftime('%Y-%m-%d'))
        )
        due_date_raw = invoice_data.get('due_date', '')
        due_date_str = self._fmt_date(due_date_raw) if due_date_raw else '—'

        overdue = self._is_overdue(invoice_data, invoice_status)

        subtotal    = float(invoice_data.get('subtotal', 0) or 0)
        discount    = float(invoice_data.get('discount', 0) or 0)
        tax_rate    = float(invoice_data.get('tax_rate', 0) or 0)
        tax_amount  = float(invoice_data.get('tax_amount', 0) or 0)
        total       = float(invoice_data.get('total', 0) or 0)
        tax_pct     = tax_rate * 100

        business_name    = self.user_info.get('business_name', '')
        sender_email     = self.user_info.get('email', '')
        sender_name      = self.user_info.get('name', '')
        typical_services = self.user_info.get('typical_services', '')

        # ── Footer callback (drawn on every page) ─────────────────────
        def _footer(canvas, doc):
            canvas.saveState()
            y = self.MARGIN - 6 * mm
            left = self.MARGIN
            right = A4[0] - self.MARGIN

            # Left: Business name · email
            left_parts = [x for x in [business_name, sender_email] if x]
            left_text = ' · '.join(left_parts) if left_parts else ''
            canvas.setFont('Helvetica', 7)
            canvas.setFillColor(p['text_secondary'])
            if left_text:
                canvas.drawString(left, y, left_text)

            # Right: Powered by ScatterPilot
            canvas.setFillColor(colors.HexColor('#A0ADB9'))
            label = 'Powered by ScatterPilot'
            canvas.drawRightString(right, y, label)

            # Thin rule above footer
            canvas.setStrokeColor(p['border'])
            canvas.setLineWidth(0.5)
            canvas.line(left, y + 3 * mm, right, y + 3 * mm)
            canvas.restoreState()

        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            leftMargin=self.MARGIN,
            rightMargin=self.MARGIN,
            topMargin=self.MARGIN,
            bottomMargin=self.MARGIN + 8 * mm,  # extra space for footer
        )

        story = []

        # ==============================================================
        # OVERDUE BANNER
        # ==============================================================
        if overdue:
            due_label = self._fmt_date(due_date_raw)
            banner_data = [[
                self._para(
                    f'<b>OVERDUE</b> — Payment was due {due_label}',
                    fontSize=9,
                    fontName='Helvetica-Bold',
                    textColor=colors.HexColor('#922412'),
                    alignment=TA_CENTER,
                )
            ]]
            banner = Table(banner_data, colWidths=[W])
            banner.setStyle(TableStyle([
                ('BACKGROUND',     (0, 0), (-1, -1), p['danger_light']),
                ('TOPPADDING',     (0, 0), (-1, -1), 7),
                ('BOTTOMPADDING',  (0, 0), (-1, -1), 7),
                ('LEFTPADDING',    (0, 0), (-1, -1), 10),
                ('RIGHTPADDING',   (0, 0), (-1, -1), 10),
                ('BOX',            (0, 0), (-1, -1), 1, p['danger']),
                ('ROUNDEDCORNERS', [3]),
            ]))
            story.append(banner)
            story.append(self._spacer(5))

        # ==============================================================
        # HEADER — Business name LEFT, INVOICE + details RIGHT
        # ==============================================================
        # Left cell
        left_lines = []
        if business_name:
            left_lines.append(self._para(
                business_name,
                fontSize=22,
                fontName='Helvetica-Bold',
                textColor=p['text'],
                leading=26,
            ))
        if typical_services and not self.is_free_tier:
            left_lines.append(self._para(
                typical_services[:80],
                fontSize=9,
                fontName='Helvetica-Oblique',
                textColor=p['text_secondary'],
                leading=13,
                spaceBefore=2,
            ))

        if not left_lines:
            # Fallback: sender name or nothing
            left_lines.append(self._para(
                sender_name or 'Invoice',
                fontSize=22,
                fontName='Helvetica-Bold',
                textColor=p['text'],
                leading=26,
            ))

        # Prepend logo mark above the business name / sender name
        logo_mark = self._logo_mark(size_pt=22.0)
        left_lines = [logo_mark, self._spacer(3)] + left_lines

        # Right cell — "INVOICE" header + meta
        right_lines = [
            self._para(
                'I N V O I C E',
                fontSize=14,
                fontName='Helvetica-Bold',
                textColor=p['primary'],
                alignment=TA_RIGHT,
                leading=18,
            ),
            self._para(
                f'<font color="#5F6B5A">#{invoice_num}</font>',
                fontSize=10,
                fontName='Helvetica',
                alignment=TA_RIGHT,
                leading=15,
                spaceBefore=6,
            ),
            self._para(
                f'<font color="#5F6B5A">Date:&nbsp;&nbsp;&nbsp;{invoice_date_str}</font>',
                fontSize=9,
                fontName='Helvetica',
                alignment=TA_RIGHT,
                leading=13,
            ),
            self._para(
                f'<font color="#5F6B5A">Due:&nbsp;&nbsp;&nbsp;&nbsp;{due_date_str}</font>',
                fontSize=9,
                fontName='Helvetica',
                alignment=TA_RIGHT,
                leading=13,
            ),
        ]

        header_tbl = Table(
            [[left_lines, right_lines]],
            colWidths=[W * 0.55, W * 0.45],
        )
        header_tbl.setStyle(TableStyle([
            ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
            ('ALIGN',         (0, 0), (0, 0),   'LEFT'),
            ('ALIGN',         (1, 0), (1, 0),   'RIGHT'),
            ('TOPPADDING',    (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ('LEFTPADDING',   (0, 0), (-1, -1), 0),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ]))
        story.append(header_tbl)
        story.append(self._spacer(4))
        story.append(self._hr(thickness=1.5, color=p['primary']))
        story.append(self._spacer(8))

        # ==============================================================
        # BILL TO  (+ FROM on the right)
        # ==============================================================
        label_style = dict(
            fontSize=8,
            fontName='Helvetica-Bold',
            textColor=p['primary'],
            leading=11,
            spaceAfter=3,
        )
        info_style = dict(
            fontSize=10,
            fontName='Helvetica',
            textColor=p['text'],
            leading=14,
        )

        # Bill To
        bill_parts = [f'<b>{invoice_data.get("customer_name", "")}</b>']
        if invoice_data.get('customer_email'):
            bill_parts.append(invoice_data['customer_email'])
        if invoice_data.get('customer_address'):
            bill_parts.append(invoice_data['customer_address'])
        bill_col = [
            self._para('BILL TO', **label_style),
            self._para('<br/>'.join(bill_parts), **info_style),
        ]

        # From (sender info — right side)
        from_parts = []
        if sender_name:
            from_parts.append(f'<b>{sender_name}</b>')
        if self.user_info.get('phone'):
            from_parts.append(self.user_info['phone'])
        if sender_email:
            from_parts.append(sender_email)
        if self.user_info.get('address'):
            from_parts.append(self.user_info['address'])

        from_col = [self._para('FROM', **label_style)]
        if from_parts:
            from_col.append(self._para('<br/>'.join(from_parts), **{**info_style, 'fontSize': 9}))

        from_right_style = {**info_style, 'alignment': TA_RIGHT, 'fontSize': 9}
        from_col_right = [
            self._para('FROM', **{**label_style, 'alignment': TA_RIGHT}),
        ]
        if from_parts:
            from_col_right.append(
                self._para('<br/>'.join(from_parts), **{**info_style, 'fontSize': 9, 'alignment': TA_RIGHT})
            )

        bill_table = Table(
            [[bill_col, from_col_right]],
            colWidths=[W * 0.55, W * 0.45],
        )
        bill_table.setStyle(TableStyle([
            ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING',    (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ('LEFTPADDING',   (0, 0), (-1, -1), 0),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ]))
        story.append(bill_table)
        story.append(self._spacer(9))

        # ==============================================================
        # LINE ITEMS TABLE
        # ==============================================================
        line_items = invoice_data.get('line_items', [])

        # Column widths: desc wide, qty narrow, rate medium, amount medium
        cw_desc   = W * 0.46
        cw_qty    = W * 0.10
        cw_rate   = W * 0.22
        cw_amount = W * 0.22
        col_widths = [cw_desc, cw_qty, cw_rate, cw_amount]

        hdr_para = lambda t: self._para(
            t,
            fontSize=8,
            fontName='Helvetica-Bold',
            textColor=p['text_secondary'],
            leading=11,
        )
        rows = [
            [hdr_para('DESCRIPTION'), hdr_para('QTY'), hdr_para('RATE'), hdr_para('AMOUNT')]
        ]

        if line_items:
            for item in line_items:
                desc = item.get('description', '')
                qty  = str(item.get('quantity', ''))
                rate = self._fmt_currency(item.get('unit_price', 0))
                amt  = self._fmt_currency(item.get('total', 0))

                desc_para = self._para(desc, fontSize=10, fontName='Helvetica', textColor=p['text'], leading=14)
                rows.append([desc_para, qty, rate, amt])
        else:
            rows.append([
                self._para('—', fontSize=10, textColor=p['text_secondary']),
                '', '', '',
            ])

        items_tbl = Table(rows, colWidths=col_widths)

        ts_cmds = [
            # Header row
            ('BACKGROUND',    (0, 0), (-1, 0), p['table_header_bg']),
            ('TOPPADDING',    (0, 0), (-1, 0), 7),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 7),
            ('LEFTPADDING',   (0, 0), (-1, 0), 8),
            ('RIGHTPADDING',  (0, 0), (-1, 0), 8),

            # Body rows
            ('FONTNAME',      (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE',      (0, 1), (-1, -1), 10),
            ('TEXTCOLOR',     (0, 1), (-1, -1), p['text']),
            ('TOPPADDING',    (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 9),
            ('LEFTPADDING',   (0, 1), (-1, -1), 8),
            ('RIGHTPADDING',  (0, 1), (-1, -1), 8),
            ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),

            # Alignments
            ('ALIGN',         (0, 0), (0, -1), 'LEFT'),    # Description
            ('ALIGN',         (1, 0), (1, -1), 'CENTER'),  # Qty
            ('ALIGN',         (2, 0), (3, -1), 'RIGHT'),   # Rate, Amount

            # Row separators
            ('LINEBELOW',     (0, 0), (-1, -2), 0.5, p['border']),

            # Outer box
            ('BOX',           (0, 0), (-1, -1), 0.5, p['border']),
        ]

        # Alternating row tint on body rows
        for i in range(2, len(rows), 2):
            ts_cmds.append(('BACKGROUND', (0, i), (-1, i), p['table_alt_row']))

        items_tbl.setStyle(TableStyle(ts_cmds))
        story.append(items_tbl)
        story.append(self._spacer(6))

        # ==============================================================
        # TOTALS — right-aligned subtable
        # ==============================================================
        tot_col_label = W * 0.22
        tot_col_value = W * 0.22
        tot_col_widths = [tot_col_label, tot_col_value]

        def _tot_row(label, value, bold=False, top_rule=False):
            fn = 'Helvetica-Bold' if bold else 'Helvetica'
            fs = 11 if bold else 9
            lc = p['text'] if bold else p['text_secondary']
            return [
                self._para(label, fontSize=fs, fontName=fn, textColor=lc, alignment=TA_RIGHT),
                self._para(value, fontSize=fs, fontName=fn, textColor=lc, alignment=TA_RIGHT),
            ]

        tot_rows = [_tot_row('Subtotal', self._fmt_currency(subtotal))]
        if discount > 0:
            tot_rows.append(_tot_row('Discount', f'−{self._fmt_currency(discount)}'))
        tot_rows.append(_tot_row(f'Tax ({tax_pct:.1f}%)', self._fmt_currency(tax_amount)))

        tot_tbl = Table(tot_rows, colWidths=tot_col_widths, hAlign='RIGHT')
        tot_tbl.setStyle(TableStyle([
            ('TOPPADDING',    (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING',   (0, 0), (-1, -1), 4),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ]))
        story.append(tot_tbl)

        # Thin rule above total
        rule_tbl = Table([['', '']], colWidths=[W - tot_col_label - tot_col_value, tot_col_label + tot_col_value])
        rule_tbl.setStyle(TableStyle([
            ('LINEBELOW',     (1, 0), (1, 0), 1, p['primary']),
            ('TOPPADDING',    (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING',   (0, 0), (-1, -1), 0),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ]))
        story.append(rule_tbl)

        # TOTAL row — bold, larger
        total_row_tbl = Table(
            [[
                self._para('TOTAL', fontSize=12, fontName='Helvetica-Bold', textColor=p['text'], alignment=TA_RIGHT),
                self._para(self._fmt_currency(total), fontSize=12, fontName='Helvetica-Bold', textColor=p['text'], alignment=TA_RIGHT),
            ]],
            colWidths=tot_col_widths,
            hAlign='RIGHT',
        )
        total_row_tbl.setStyle(TableStyle([
            ('TOPPADDING',    (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING',   (0, 0), (-1, -1), 4),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 0),
        ]))
        story.append(total_row_tbl)
        story.append(self._spacer(8))

        # ==============================================================
        # AMOUNT DUE — prominent right-aligned box
        # ==============================================================
        box_w = W * 0.48
        amount_due_tbl = Table(
            [[
                self._para('AMOUNT DUE', fontSize=8, fontName='Helvetica-Bold',
                           textColor=p['text_secondary'], alignment=TA_RIGHT, leading=12),
                '',
            ],
            [
                self._para(self._fmt_currency(total), fontSize=20, fontName='Helvetica-Bold',
                           textColor=p['text'], alignment=TA_RIGHT, leading=24),
                '',
            ]],
            colWidths=[box_w - 16, 8],
            hAlign='RIGHT',
        )
        amount_due_tbl.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, -1), p['amount_due_bg']),
            ('TOPPADDING',    (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (0, 0), 2),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 12),
            ('LEFTPADDING',   (0, 0), (-1, -1), 14),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 6),
            ('LINEAFTER',     (-1, 0), (-1, -1), 3, p['primary']),
            ('BOX',           (0, 0), (-1, -1), 0.5, p['border']),
            ('ROUNDEDCORNERS', [4]),
        ]))
        story.append(amount_due_tbl)

        # ==============================================================
        # NOTES
        # ==============================================================
        if invoice_data.get('notes'):
            story.append(self._spacer(9))
            story.append(self._hr())
            story.append(self._spacer(6))
            story.append(self._para(
                'NOTES', fontSize=8, fontName='Helvetica-Bold',
                textColor=p['primary'], leading=11,
            ))
            story.append(self._spacer(2))
            story.append(self._para(
                invoice_data['notes'],
                fontSize=9, fontName='Helvetica', textColor=p['text_secondary'], leading=13,
            ))

        # ==============================================================
        # PAYMENT SECTION — text LEFT, QR code RIGHT
        # ==============================================================
        if payment_url:
            story.append(self._spacer(10))
            story.append(self._hr())
            story.append(self._spacer(6))

            pay_label_style = dict(
                fontSize=8, fontName='Helvetica-Bold',
                textColor=p['primary'], leading=11,
            )
            pay_text_style = dict(
                fontSize=9, fontName='Helvetica',
                textColor=p['text_secondary'], leading=13,
            )
            pay_url_style = dict(
                fontSize=8, fontName='Helvetica',
                textColor=p['accent'], leading=12,
            )

            # Truncate long URLs for display
            display_url = payment_url if len(payment_url) <= 70 else payment_url[:67] + '...'

            left_pay = [
                self._para('PAYMENT', **pay_label_style),
                self._spacer(3),
                self._para('Pay online:', **pay_text_style),
                self._para(
                    f'<link href="{payment_url}">{display_url}</link>',
                    **pay_url_style,
                ),
                self._spacer(6),
                self._para(
                    'Payment is due within 30 days of invoice date.',
                    **pay_text_style,
                ),
                self._para(
                    'Scan the QR code to pay securely via Stripe.',
                    **pay_text_style,
                ),
            ]

            try:
                qr = self._qr_image(payment_url, size_mm=28)
                right_pay = [[qr]]
            except Exception as qr_err:
                logger.warning("Failed to generate QR code", error=str(qr_err))
                right_pay = [['']]

            qr_tbl = Table(right_pay, colWidths=[30 * mm])
            qr_tbl.setStyle(TableStyle([
                ('ALIGN',        (0, 0), (-1, -1), 'RIGHT'),
                ('VALIGN',       (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING',   (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING',(0, 0), (-1, -1), 0),
                ('LEFTPADDING',  (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ]))

            pay_section = Table(
                [[left_pay, qr_tbl]],
                colWidths=[W - 35 * mm, 35 * mm],
            )
            pay_section.setStyle(TableStyle([
                ('VALIGN',       (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING',   (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING',(0, 0), (-1, -1), 0),
                ('LEFTPADDING',  (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ]))
            story.append(pay_section)

        # ==============================================================
        # BUILD
        # ==============================================================
        doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
        pdf_bytes = buf.getvalue()
        buf.close()
        return pdf_bytes


# =============================================================================
# USER INFO HELPER
# =============================================================================

def get_user_info_from_cognito(event: Dict[str, Any], user_id: str = None, is_pro: bool = False) -> Dict[str, Any]:
    """
    Extract user information from Cognito claims and DynamoDB profile.

    Tier rule: business_name is shown for Pro users only.
    Contact details (name, phone, email, address) shown for all tiers.
    """
    user_info = {}

    try:
        authorizer = event.get('requestContext', {}).get('authorizer', {})
        claims = authorizer.get('claims', {})
        user_info['email'] = claims.get('email', '')

        if user_id:
            try:
                db = DynamoDBHelper()
                profile = db.get_user_profile(user_id)
                if profile:
                    if is_pro and profile.get('business_name'):
                        user_info['business_name'] = profile['business_name']

                    if profile.get('contact_name'):
                        user_info['name'] = profile['contact_name']
                    if profile.get('phone'):
                        user_info['phone'] = profile['phone']
                    if profile.get('email'):
                        user_info['email'] = profile['email']
                    if profile.get('typical_services') and is_pro:
                        user_info['typical_services'] = profile['typical_services']

                    # Build address string
                    addr = []
                    if profile.get('address_line1'):
                        addr.append(profile['address_line1'])
                    if profile.get('address_line2'):
                        addr.append(profile['address_line2'])
                    csz = ', '.join(
                        x for x in [profile.get('city'), profile.get('state'), profile.get('zip_code')] if x
                    )
                    if csz:
                        addr.append(csz)
                    if profile.get('country') and profile['country'] != 'USA':
                        addr.append(profile['country'])
                    if addr:
                        user_info['address'] = '<br/>'.join(addr)

            except Exception as err:
                logger.warning("Failed to fetch user profile", error=str(err))

    except Exception as err:
        logger.warning("Failed to extract user info from Cognito", error=str(err))

    return user_info


# =============================================================================
# LAMBDA HANDLER
# =============================================================================

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for PDF generation.

    Path parameters:
        invoice_id — Invoice UUID

    Returns API Gateway response with S3 download URL.
    """
    logger.log_lambda_invocation(event, context)
    request_id = context.aws_request_id if context else 'local'
    logger.set_correlation_id(request_id)

    try:
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        path_params = event.get('pathParameters') or {}
        invoice_id = path_params.get('invoice_id')
        if not invoice_id:
            return create_error_response(400, 'Invoice ID is required', 'ValidationError')

        try:
            invoice_id = validate_uuid(invoice_id, 'Invoice ID')
        except InputValidationError as e:
            return create_error_response(400, str(e), 'ValidationError')

        db_helper = DynamoDBHelper()
        invoice = db_helper.get_invoice(invoice_id)
        if not invoice:
            return create_error_response(404, 'Invoice not found', 'NotFound')
        if invoice.user_id != user_id:
            return create_error_response(403, 'Not authorized', 'Forbidden')

        # ── Subscription / tier ──────────────────────────────────────
        is_pro = False
        color_preference = None
        subscription = None
        try:
            subscription = db_helper.get_user_subscription(user_id)
            is_pro = bool(subscription and subscription.get('subscription_status') == 'pro')
            color_preference = subscription.get('invoice_color') if subscription else None
        except Exception as sub_err:
            logger.warning('Subscription lookup failed, defaulting to free tier', error=str(sub_err))

        # ── Payment URL for QR code ──────────────────────────────────
        # Prefer the stable public invoice page (/pay/{id}) when user has
        # a Standard connected account — that always creates a fresh session.
        # Fall back to any stored payment_link_url from the old flow.
        payment_url = None
        frontend_url = os.environ.get('FRONTEND_URL', '')
        try:
            dynamodb = boto3.resource('dynamodb')
            raw_tbl = dynamodb.Table(os.environ.get('INVOICES_TABLE', 'ScatterPilot-Invoices-dev'))
            raw_inv = raw_tbl.get_item(
                Key={'invoice_id': invoice_id},
                ProjectionExpression='payment_link_url',
            ).get('Item', {})

            connected_account = subscription.get('stripe_connected_account_id') if subscription else None

            if connected_account and frontend_url:
                # Use the permanent public page — clients always get a fresh checkout
                payment_url = f'{frontend_url}/pay/{invoice_id}'
            elif raw_inv.get('payment_link_url'):
                payment_url = raw_inv['payment_link_url']

        except Exception as pl_err:
            logger.warning('Failed to resolve payment URL', error=str(pl_err))

        invoice_status = str(getattr(invoice, 'status', 'draft') or 'draft')

        logger.info(
            'Generating PDF',
            invoice_id=invoice_id, is_pro=is_pro,
            color=color_preference, has_payment_url=bool(payment_url),
            status=invoice_status,
        )

        user_info = get_user_info_from_cognito(event, user_id, is_pro=is_pro)
        color_palette = get_color_palette(is_pro, color_preference)

        pdf_gen = PDFGenerator(color_palette=color_palette, is_free_tier=not is_pro, user_info=user_info)
        pdf_bytes = pdf_gen.generate(
            invoice_data=invoice.data.to_dynamodb(),
            invoice_id=invoice_id,
            invoice_status=invoice_status,
            payment_url=payment_url,
        )

        # ── Upload to S3 ─────────────────────────────────────────────
        s3_bucket = os.environ.get('INVOICE_BUCKET', 'scatterpilot-invoices')
        s3_key = f'invoices/{user_id}/{invoice_id}.pdf'

        boto3.client('s3').put_object(
            Bucket=s3_bucket,
            Key=s3_key,
            Body=pdf_bytes,
            ContentType='application/pdf',
            ServerSideEncryption='AES256',
        )

        logger.info('PDF uploaded', bucket=s3_bucket, key=s3_key)

        db_helper.update_invoice_status(
            invoice_id=invoice_id,
            status=InvoiceStatus.PENDING,
            pdf_s3_key=s3_key,
        )

        download_url = f'https://{s3_bucket}.s3.amazonaws.com/{s3_key}'

        return create_success_response({
            'invoice_id':   invoice_id,
            'pdf_generated': True,
            'download_url':  download_url,
            'status':        'completed',
            's3_location':   {'bucket': s3_bucket, 'key': s3_key},
        })

    except InputValidationError as e:
        logger.warning('Input validation error', error=e)
        return create_error_response(400, str(e), 'ValidationError')
    except DynamoDBException as e:
        logger.error('Database error', error=e)
        return create_error_response(500, 'Database error occurred', 'DatabaseError')
    except Exception as e:
        logger.error('Unexpected error in PDF generation', error=e)
        return create_error_response(500, 'Failed to generate PDF', 'InternalError')
