"""
Cognito CustomEmailSender trigger — sends branded verification and
password reset emails via Resend.

This is the CustomEmailSender trigger (not CustomMessage). Cognito passes
the verification code KMS-encrypted; we decrypt it, then send the branded
email via Resend before returning the event.

Handles:
  CustomEmailSender_SignUp
  CustomEmailSender_ResendCode
  CustomEmailSender_ForgotPassword
"""

import base64
import logging
import os
import sys

import boto3

sys.path.insert(0, '/opt/python')

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

kms_client = boto3.client('kms')

RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
RESEND_SENDER  = os.environ.get('RESEND_SENDER', 'authenticate@scatterpilot.com')

HANDLED_TRIGGERS = {
    'CustomEmailSender_SignUp',
    'CustomEmailSender_ResendCode',
    'CustomEmailSender_ForgotPassword',
}


# =============================================================================
# KMS decryption
# =============================================================================

def _decrypt_code(encrypted_code: str, user_pool_id: str) -> str:
    """Decrypt the KMS-encrypted verification code Cognito passes in the event.

    Cognito encrypts the code with EncryptionContext={'userPoolId': <pool-id>};
    the same context must be supplied to KMS decrypt or it raises
    InvalidCiphertextException.
    """
    decoded = base64.b64decode(encrypted_code)
    response = kms_client.decrypt(
        CiphertextBlob=decoded,
        EncryptionContext={'userPoolId': user_pool_id},
    )
    return response['Plaintext'].decode('utf-8')


# =============================================================================
# Email HTML builders — sage brand
# =============================================================================

def _verification_html(code: str) -> str:
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
                  {code}
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


def _password_reset_html(code: str) -> str:
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
                  {code}
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

def _send_email(to_email: str, subject: str, html_body: str) -> None:
    import resend  # available via CommonLayer (resend>=2.0.0)
    resend.api_key = RESEND_API_KEY
    params: resend.Emails.SendParams = {
        'from': f'ScatterPilot <{RESEND_SENDER}>',
        'to': [to_email],
        'subject': subject,
        'html': html_body,
    }
    result = resend.Emails.send(params)
    logger.info("Email sent via Resend: id=%s", result.get('id'))


# =============================================================================
# Handler
# =============================================================================

def handler(event, context):
    trigger_source = event.get('triggerSource', '')
    logger.info("CustomEmailSender trigger: %s", trigger_source)

    if trigger_source not in HANDLED_TRIGGERS:
        logger.info("Unhandled trigger %s — returning event unchanged", trigger_source)
        return event

    request        = event.get('request', {})
    user_attributes = request.get('userAttributes', {})
    encrypted_code = request.get('code')
    to_email       = user_attributes.get('email')

    if not to_email:
        logger.error("No email in userAttributes — cannot send")
        return event

    if not encrypted_code:
        logger.error("No code in request — cannot send")
        return event

    # Decrypt the KMS-protected code Cognito provides.
    # userPoolId must be passed as EncryptionContext to match how Cognito encrypted it.
    user_pool_id = event.get('userPoolId', '')
    code = _decrypt_code(encrypted_code, user_pool_id)

    if trigger_source in ('CustomEmailSender_SignUp', 'CustomEmailSender_ResendCode'):
        subject  = 'Verify your ScatterPilot account'
        html_body = _verification_html(code)
    else:  # CustomEmailSender_ForgotPassword
        subject  = 'Reset your ScatterPilot password'
        html_body = _password_reset_html(code)

    _send_email(to_email, subject, html_body)
    logger.info("Branded email dispatched for %s", trigger_source)

    return event
