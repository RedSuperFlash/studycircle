import { useState } from 'react';
import { Flag, ExternalLink } from 'lucide-react';
import { useAction, useWorkspace } from '../hooks/workspace';
import { Area, Button, Feedback, Form, Select, field } from './ui';
export function Report({ kind, item }: { kind: string; item: string }) {
  const [open, set] = useState(false);
  const { db } = useWorkspace();
  const action = useAction();
  return (
    <div className="report-control">
      <button type="button" className="subtle" aria-expanded={open} onClick={() => set(!open)}>
        <Flag size={14} /> Report
      </button>
      {open && (
        <Form
          onSubmit={(d) =>
            action.run(
              () =>
                db.rpc('report_content', {
                  kind,
                  item,
                  classification: field(d, 'category'),
                  details: field(d, 'details'),
                }),
              'Report sent for review.',
            )
          }
        >
          <p className="muted">
            A moderator can review the reported item. Access is recorded in the audit log.
          </p>
          <Select
            label="Report category"
            name="category"
            options={[
              'Harassment',
              'Unwanted contact',
              'Spam or fraud',
              'Academic integrity',
              'Discrimination',
              'Unsafe content',
              'Location or privacy misuse',
              'Other',
            ]}
          />
          <Area label="Reason" name="details" required maxLength={2000} />
          <Button type="submit" disabled={action.busy}>
            Submit report
          </Button>
        </Form>
      )}
      <Feedback {...action} />
    </div>
  );
}
export function Attachment({
  bucket,
  path,
  label,
}: {
  bucket: string;
  path: string;
  label: string;
}) {
  const { db } = useWorkspace();
  const action = useAction();
  const [url, set] = useState('');
  return (
    <div>
      {url ? (
        <a
          className="button"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setTimeout(() => set(''), 1000)}
        >
          {label}
          <ExternalLink size={14} />
        </a>
      ) : (
        <Button
          onClick={() => void action.run(async () => set(await db.open(bucket, path)))}
          disabled={action.busy}
        >
          Prepare {label}
        </Button>
      )}
      <Feedback {...action} />
    </div>
  );
}
