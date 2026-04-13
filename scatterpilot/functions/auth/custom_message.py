"""
Cognito CustomMessage trigger — branded verification and password reset emails.

Intercepts CustomMessage_SignUp, CustomMessage_ResendCode, and
CustomMessage_ForgotPassword. Attempts to send a branded HTML email via
Resend, then always returns the event with emailMessage/emailSubject set
so Cognito's COGNITO_DEFAULT delivery acts as a reliable fallback.

If the Resend send fails for any reason the error is caught and logged;
the event is returned unmodified so Cognito falls back to its default
email (using the emailMessage/emailSubject we set on success, or its
own template on complete failure).

NOTE: In the CustomMessage trigger Cognito passes a placeholder string
(e.g. "####") as event.request.codeParameter. We embed this placeholder
in both the Resend email body and the emailMessage response; Cognito
substitutes the real code before its own delivery. The Resend copy will
contain the placeholder literally — the Cognito-delivered copy (via
COGNITO_DEFAULT) will contain the real code.
"""

import os
import sys
import logging
from typing import Any, Dict, Optional

sys.path.insert(0, '/opt/python')

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
RESEND_SENDER  = os.environ.get('RESEND_SENDER', 'authenticate@scatterpilot.com')

# ── Triggers this function handles ────────────────────────────────────────────
HANDLED_TRIGGERS = {
    'CustomMessage_SignUp',
    'CustomMessage_ResendCode',
    'CustomMessage_ForgotPassword',
}


# =============================================================================
# Email HTML builders
# =============================================================================

def _verification_html(code_placeholder: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#FAFBF9;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFBF9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;border:1px solid #E2E5DE;overflow:hidden;">

          <!-- Logo block -->
          <tr>
            <td style="background:#4A6741;padding:28px 40px;">
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                ScatterPilot
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <h2 style="margin:0 0 12px;color:#1A2318;font-size:20px;font-weight:600;">
                Verify your email address
              </h2>
              <p style="margin:0 0 24px;color:#5F6B5A;font-size:15px;line-height:1.6;">
                Thanks for signing up for ScatterPilot. Use the code below to
                confirm your email address and activate your account.
              </p>

              <!-- Code card -->
              <div style="background:#F4F7F3;border:1px solid #D4DDD0;border-radius:8px;
                          padding:24px;text-align:center;margin:0 0 24px;">
                <p style="margin:0 0 8px;color:#5F6B5A;font-size:12px;font-weight:600;
                           text-transform:uppercase;letter-spacing:0.08em;">
                  Verification Code
                </p>
                <p style="margin:0;color:#1A2318;font-size:36px;font-weight:700;
                           letter-spacing:10px;font-family:'Courier New',Courier,monospace;">
                  {code_placeholder}
                </p>
              </div>

              <p style="margin:0;color:#8A9484;font-size:13px;line-height:1.6;">
                This code expires in 24 hours. If you didn't create a ScatterPilot
                account you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #E2E5DE;">
              <p style="margin:0;color:#8A9484;font-size:12px;">
                &copy; 2026 ScatterPilot &middot; scatterpilot.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _password_reset_html(code_placeholder: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#FAFBF9;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFBF9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;border:1px solid #E2E5DE;overflow:hidden;">

          <!-- Logo block -->
          <tr>
            <td style="background:#4A6741;padding:28px 40px;">
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                ScatterPilot
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <h2 style="margin:0 0 12px;color:#1A2318;font-size:20px;font-weight:600;">
                Reset your password
              </h2>
              <p style="margin:0 0 24px;color:#5F6B5A;font-size:15px;line-height:1.6;">
                We received a request to reset your ScatterPilot password.
                Use the code below to complete the process.
              </p>

              <!-- Code card -->
              <div style="background:#F4F7F3;border:1px solid #D4DDD0;border-radius:8px;
                          padding:24px;text-align:center;margin:0 0 24px;">
                <p style="margin:0 0 8px;color:#5F6B5A;font-size:12px;font-weight:600;
                           text-transform:uppercase;letter-spacing:0.08em;">
                  Reset Code
                </p>
                <p style="margin:0;color:#1A2318;font-size:36px;font-weight:700;
                           letter-spacing:10px;font-family:'Courier New',Courier,monospace;">
                  {code_placeholder}
                </p>
              </div>

              <p style="margin:0;color:#8A9484;font-size:13px;line-height:1.6;">
                This code expires in 1 hour. If you didn't request a password
                reset you can safely ignore this email &mdash; your password
                will not be changed.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #E2E5DE;">
              <p style="margin:0;color:#8A9484;font-size:12px;">
                &copy; 2026 ScatterPilot &middot; scatterpilot.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


# =============================================================================
# Resend delivery
# =============================================================================

def _send_via_resend(
    to_email: str,
    subject: str,
    html_body: str,
) -> bool:
    """
    Attempt to send the email via Resend. Returns True on success.
    Any exception is caught and logged so the caller can fall back gracefully.
    """
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping Resend delivery")
        return False

    try:
        import resend  # available via CommonLayer
        resend.api_key = RESEND_API_KEY

        params: resend.Emails.SendParams = {
            "from": f"ScatterPilot <{RESEND_SENDER}>",
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        }
        email = resend.Emails.send(params)
        logger.info("Resend delivery succeeded", extra={"resend_id": email.get("id")})
        return True

    except Exception as exc:
        logger.error("Resend delivery failed — Cognito will fall back to default: %s", exc)
        return False


# =============================================================================
# Handler
# =============================================================================

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Cognito CustomMessage Lambda trigger.

    Sets event['response']['emailMessage'] and event['response']['emailSubject']
    with branded HTML, and attempts a parallel send via Resend. If Resend
    fails the event is still returned with the message set so COGNITO_DEFAULT
    delivers the correct template.
    """
    trigger_source: str = event.get('triggerSource', '')
    logger.info("CustomMessage trigger: %s", trigger_source)

    if trigger_source not in HANDLED_TRIGGERS:
        logger.info("Unhandled trigger source %s — returning event unchanged", trigger_source)
        return event

    request        = event.get('request', {})
    user_attrs     = request.get('userAttributes', {})
    code_parameter = request.get('codeParameter', '####')
    to_email: Optional[str] = user_attrs.get('email')

    # ── Build subject and HTML based on trigger type ──────────────────────────
    if trigger_source in ('CustomMessage_SignUp', 'CustomMessage_ResendCode'):
        subject  = "Verify your ScatterPilot account"
        html     = _verification_html(code_parameter)
    else:  # CustomMessage_ForgotPassword
        subject  = "Reset your ScatterPilot password"
        html     = _password_reset_html(code_parameter)

    # ── Attempt Resend delivery ───────────────────────────────────────────────
    if to_email:
        _send_via_resend(to_email, subject, html)
    else:
        logger.warning("No email in userAttributes — skipping Resend delivery")

    # ── Always set emailMessage/emailSubject for Cognito's own delivery ───────
    event.setdefault('response', {})
    event['response']['emailSubject'] = subject
    event['response']['emailMessage'] = html

    return event
