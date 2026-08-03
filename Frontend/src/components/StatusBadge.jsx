import { Clock, CheckCircle2, XCircle } from 'lucide-react';

// The app's signature visual element -- a colored pill shown everywhere an
// application status appears (applicant and admin views alike), so status
// is always instantly recognizable regardless of context. The three
// statuses (submitted / interview / rejected) are the only ones this app
// supports -- see server/sql/schema.sql for why.
const STATUS_ICONS = {
  submitted: Clock,
  interview: CheckCircle2,
  rejected: XCircle,
};

export default function StatusBadge({ status }) {
  const Icon = STATUS_ICONS[status] ?? Clock;
  return (
    <span className={`status-badge status-${status}`}>
      <Icon size={13} strokeWidth={2.5} />
      {status}
    </span>
  );
}
