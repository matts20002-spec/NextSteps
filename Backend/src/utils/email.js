// Sends the two interview/rejection emails via AWS SES.
//
// Templates are plain strings with simple {placeholder} substitution -- a
// template editor was cut from the MVP scope; revisit if the hiring team
// needs to customize this copy themselves post-launch.
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({ region: process.env.AWS_REGION });

// Replaces {studentName} / {jobTitle} placeholders in a template string.
function fillTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (_match, key) => values[key] ?? '');
}

const INTERVIEW_SUBJECT = 'Interview Invitation for {jobTitle}';
const INTERVIEW_BODY = `Hi {studentName},

Thank you for applying for the {jobTitle} position. We were impressed with your
application and would like to invite you to interview.

Our team will be in touch shortly to schedule a time.

Best regards,
The Hiring Team`;

const REJECTION_SUBJECT = 'Update on your application for {jobTitle}';
const REJECTION_BODY = `Hi {studentName},

Thank you for applying for the {jobTitle} position and for the time you invested
in your application. After careful review, we've decided to move forward with
other candidates for this role.

We appreciate your interest and encourage you to apply for future openings.

Best regards,
The Hiring Team`;

/**
 * Sends an email via SES to `toEmail`, filling `subject`/`body` templates
 * with `{studentName, jobTitle}`.
 *
 * NOTE (SES sandbox): while your SES account is in sandbox mode, both the
 * sender (SES_SENDER_EMAIL) AND every recipient must be verified SES
 * identities. See the README for how to verify a test address and use it
 * as both your applicant account email and test recipient.
 */
async function sendTemplatedEmail({ toEmail, subjectTemplate, bodyTemplate, studentName, jobTitle }) {
  const values = { studentName, jobTitle };
  const subject = fillTemplate(subjectTemplate, values);
  const body = fillTemplate(bodyTemplate, values);

  const command = new SendEmailCommand({
    Source: process.env.SES_SENDER_EMAIL,
    Destination: { ToAddresses: [toEmail] },
    Message: {
      Subject: { Data: subject },
      Body: { Text: { Data: body } },
    },
  });

  await ses.send(command);
}

async function sendInterviewInvitation({ toEmail, studentName, jobTitle }) {
  return sendTemplatedEmail({
    toEmail,
    subjectTemplate: INTERVIEW_SUBJECT,
    bodyTemplate: INTERVIEW_BODY,
    studentName,
    jobTitle,
  });
}

async function sendRejection({ toEmail, studentName, jobTitle }) {
  return sendTemplatedEmail({
    toEmail,
    subjectTemplate: REJECTION_SUBJECT,
    bodyTemplate: REJECTION_BODY,
    studentName,
    jobTitle,
  });
}

module.exports = { sendInterviewInvitation, sendRejection };
