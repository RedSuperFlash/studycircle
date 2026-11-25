import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import {
  Area,
  Button,
  Disclosure,
  Empty,
  Feedback,
  Field,
  Form,
  PageTitle,
  Person,
  QueryState,
  Section,
  Select,
  Tabs,
  field,
  optional,
} from '../components/ui';
import { MetricChart } from '../components/Charts';
import { useAction, useRows, useRPC, useWorkspace } from '../hooks/workspace';
import { dateLabel } from '../lib/format';
import type { Row } from '../types';

export default function Admin() {
  const { role, demo } = useWorkspace();
  const [p] = useSearchParams();
  const tabs =
    role === 'admin'
      ? [
          'Report queue',
          'Analytics',
          'Students',
          'Catalog',
          'Verification',
          'Appeals',
          'Audit log',
          'Settings',
        ]
      : ['Report queue', 'Audit log'];
  const tab = tabs.includes(p.get('tab') || '') ? p.get('tab') : tabs[0];
  return (
    <>
      <PageTitle
        title={role === 'admin' ? 'Administration' : 'Moderation'}
        detail={
          demo
            ? 'Review fictional reports and demonstrate the audit trail.'
            : 'Review reports, manage academic spaces and monitor platform activity.'
        }
      />
      <Tabs labels={tabs} />
      {tab === 'Analytics' ? (
        <Analytics />
      ) : tab === 'Students' ? (
        <Students />
      ) : tab === 'Catalog' ? (
        <Catalog />
      ) : tab === 'Verification' ? (
        <Verification />
      ) : tab === 'Appeals' ? (
        <Appeals />
      ) : tab === 'Audit log' ? (
        <Audit />
      ) : tab === 'Settings' ? (
        <Settings />
      ) : (
        <Reports />
      )}
    </>
  );
}
function Reports() {
  const reports = useRows('reports', { order: 'created_at', desc: true });
  const cases = useRows('moderation_cases');
  const [filter, setFilter] = useState('pending');
  const view = reports.data.filter((r) => filter === 'all' || r.status === filter);
  return (
    <Section
      title="Report queue"
      action={
        <Select
          label="Status"
          name="status"
          value={filter}
          onChange={setFilter}
          options={['pending', 'resolved', 'dismissed', 'all']}
        />
      }
    >
      <p className="muted">
        Opening a report records an audit event. The evidence contains the reported item and
        excludes surrounding private messages.
      </p>
      <QueryState {...reports} />
      {view.map((r) => (
        <ReportCase key={r.id} report={r} caseRow={cases.data.find((c) => c.report_id === r.id)} />
      ))}
      {!reports.loading && !view.length && (
        <Empty icon={ShieldCheck} title="No reports in this view" />
      )}
    </Section>
  );
}
function ReportCase({ report, caseRow }: { report: Row; caseRow?: Row }) {
  const { db, role, user } = useWorkspace();
  const action = useAction();
  const [evidence, setEvidence] = useState<string | null>(null);
  const options =
    report.target_type === 'user'
      ? ['dismiss', 'warn', 'suspend']
      : ['dismiss', 'hide', 'warn', 'suspend'];
  if (role === 'admin') options.push('ban');
  return (
    <Disclosure label={report.category + ' · ' + report.target_type + ' · ' + report.status}>
      <p>{report.reason}</p>
      <p className="fine-print">
        Filed {dateLabel(report.created_at)}
        {caseRow ? ' · Case ' + caseRow.id?.slice(0, 8) : ''}
      </p>
      <div className="button-row">
        <Button
          onClick={() =>
            void action.run(async () => {
              const rows = await db.rpc<Row[]>('inspect_report', { ticket: report.id });
              setEvidence(rows[0]?.content || 'No evidence recorded.');
            })
          }
          disabled={action.busy}
        >
          Open reported item
        </Button>
        {report.status === 'pending' && !caseRow?.assigned_to && (
          <Button
            onClick={() =>
              void action.run(
                () => db.rpc('claim_report', { ticket: report.id }),
                'Case assigned to you.',
              )
            }
            disabled={action.busy}
          >
            Claim case
          </Button>
        )}
        {caseRow?.assigned_to && (
          <span className="chip">
            {caseRow.assigned_to === user ? 'Assigned to you' : <Person id={caseRow.assigned_to} />}
          </span>
        )}
      </div>
      {evidence && <blockquote className="evidence">{evidence}</blockquote>}
      {report.status === 'pending' && (
        <Form
          onSubmit={(d) =>
            action.run(
              () =>
                db.rpc('resolve_report', {
                  ticket: report.id,
                  decision: field(d, 'decision'),
                  explanation: field(d, 'explanation'),
                }),
              'Report resolved and action recorded.',
            )
          }
        >
          <Select label="Disposition" name="decision" options={options} />
          <Area label="Reason for the decision" name="explanation" maxLength={1000} required />
          <Button className="primary" type="submit" disabled={action.busy}>
            Resolve report
          </Button>
        </Form>
      )}
      <Feedback {...action} />
    </Disclosure>
  );
}
function Analytics() {
  const metrics = useRPC<Row>('admin_metrics', undefined, {});
  return (
    <>
      <QueryState {...metrics} />
      <div className="metric-grid">
        {Object.entries(metrics.data)
          .filter(([, v]) => typeof v === 'number')
          .map(([k, v]) => (
            <div className="panel metric" key={k}>
              <strong>{v}</strong>
              <span>{k}</span>
            </div>
          ))}
      </div>
      <div className="two-column">
        <Section title="Questions by subject">
          {metrics.data.subjects?.length ? (
            <MetricChart label="Questions" data={metrics.data.subjects} />
          ) : (
            <Empty title="No subject activity yet" />
          )}
        </Section>
        <Section title="Regional activity">
          {metrics.data.regions?.length ? (
            <MetricChart label="Opted-in members" data={metrics.data.regions} />
          ) : (
            <Empty
              title="No publishable regional totals"
              detail="Regions appear when at least five students opt into local matching."
            />
          )}
        </Section>
      </div>
    </>
  );
}
function Students() {
  const { db } = useWorkspace();
  const action = useAction();
  const directory = useRPC<Row[]>('admin_directory', undefined, []);
  const [search, setSearch] = useState('');
  return (
    <Section title="Student directory">
      <Field
        label="Find a student by alias or ID"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <QueryState {...directory} />
      <Feedback {...action} />
      {directory.data
        .filter((r) => [r.alias, r.id].join(' ').toLowerCase().includes(search.toLowerCase()))
        .map((r) => (
          <Disclosure
            key={r.id}
            label={r.alias + ' · ' + r.role + (r.restricted ? ' · Restricted' : '')}
          >
            <p className="user-id">{r.id}</p>
            <Form
              onSubmit={(d) =>
                action.run(
                  () =>
                    db.rpc('admin_action', {
                      kind: 'user',
                      item: r.id,
                      action: field(d, 'action'),
                      payload: { note: field(d, 'note') },
                    }),
                  'Account action recorded.',
                )
              }
            >
              <Select
                label="Account action"
                name="action"
                options={['warn', 'suspend', 'ban', 'restore']}
              />
              <Field label="Reason" name="note" maxLength={1000} required />
              <Button type="submit" disabled={action.busy || r.role === 'admin'}>
                Apply account action
              </Button>
            </Form>
            {r.role !== 'admin' && (
              <Button
                onClick={() =>
                  void action.run(
                    () =>
                      db.rpc('admin_action', {
                        kind: 'role',
                        item: r.id,
                        action: r.role === 'moderator' ? 'revoke' : 'grant',
                      }),
                    'Moderator access updated.',
                  )
                }
                disabled={action.busy}
              >
                {r.role === 'moderator' ? 'Remove moderator role' : 'Make moderator'}
              </Button>
            )}
          </Disclosure>
        ))}
    </Section>
  );
}
function Catalog() {
  const { db } = useWorkspace();
  const action = useAction();
  const catalogs = useRPC<Row>('admin_catalog', undefined, {});
  const [kind, setKind] = useState('subject');
  return (
    <div className="two-column">
      <Section title="Academic catalog">
        <Form
          onSubmit={(d) =>
            action.run(
              () =>
                db.rpc('admin_action', {
                  kind,
                  item: field(d, 'id'),
                  action: 'save',
                  payload: {
                    name: field(d, 'name'),
                    description: field(d, 'description'),
                    domain: optional(d, 'domain'),
                    category: optional(d, 'category'),
                    subject_id: optional(d, 'subject_id'),
                  },
                }),
              'Catalog saved.',
            )
          }
        >
          <Select
            label="Record type"
            options={['subject', 'institution', 'community']}
            value={kind}
            onChange={setKind}
          />
          <Field label="Record key" name="id" required maxLength={60} pattern="[a-z0-9-]+" />
          <Field label="Name" name="name" required maxLength={100} />
          {kind === 'institution' && (
            <Field label="Institutional email domain" name="domain" maxLength={120} />
          )}
          {kind === 'community' && (
            <>
              <Area label="Description" name="description" required maxLength={400} />
              <Select
                label="Category"
                name="category"
                options={['Subject', 'Topic', 'Course', 'Institution', 'Exam', 'Local', 'Language']}
              />
              <Field label="Optional subject key" name="subject_id" />
            </>
          )}
          <Button className="primary" type="submit" disabled={action.busy}>
            Save catalog record
          </Button>
          <Feedback {...action} />
        </Form>
      </Section>
      <Section title="Community and group visibility">
        <QueryState {...catalogs} />
        {['communities', 'groups'].flatMap((key) =>
          (catalogs.data[key] || []).map((r: Row) => (
            <div className="list-row" key={r.id}>
              <span>
                <strong>{r.name}</strong>
                <small>
                  {key === 'groups' ? 'Study group' : 'Community'} ·{' '}
                  {r.archived ? 'Archived' : 'Visible'}
                </small>
              </span>
              <Button
                disabled={action.busy}
                onClick={() =>
                  void action.run(
                    () =>
                      db.rpc('admin_action', {
                        kind: key === 'groups' ? 'group' : 'community',
                        item: r.id,
                        action: r.archived ? 'restore' : 'archive',
                      }),
                    'Visibility updated.',
                  )
                }
              >
                {r.archived ? 'Restore' : 'Archive'}
              </Button>
            </div>
          )),
        )}
      </Section>
    </div>
  );
}
function Verification() {
  const { db } = useWorkspace();
  const action = useAction();
  const requests = useRows('verification_requests', { order: 'created_at', desc: true });
  return (
    <Section title="Institution verification requests">
      <QueryState {...requests} />
      <Feedback {...action} />
      {requests.data.map((v) => (
        <div className="list-row" key={v.id}>
          <span>
            <strong>
              <Person id={v.user_id} />
            </strong>
            <small>
              {v.institution_id} · {v.status}
            </small>
          </span>
          {v.status === 'pending' && (
            <div className="button-row">
              {['verified', 'declined'].map((decision) => (
                <Button
                  key={decision}
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(
                      () =>
                        db.rpc('admin_action', {
                          kind: 'verification',
                          item: v.id,
                          action: decision,
                        }),
                      'Verification request updated.',
                    )
                  }
                >
                  {decision === 'verified' ? 'Verify' : 'Decline'}
                </Button>
              ))}
            </div>
          )}
        </div>
      ))}
      {!requests.loading && !requests.data.length && <Empty title="No verification requests" />}
    </Section>
  );
}
function Appeals() {
  const { db } = useWorkspace();
  const action = useAction();
  const rows = useRows('moderation_appeals', { order: 'created_at', desc: true });
  return (
    <Section title="Moderation appeals">
      <QueryState {...rows} />
      <Feedback {...action} />
      {rows.data.map((a) => (
        <Disclosure key={a.id} label={a.status + ' · ' + dateLabel(a.created_at)}>
          <p>{a.body}</p>
          {a.status === 'pending' && (
            <div className="button-row">
              {['upheld', 'overturned'].map((decision) => (
                <Button
                  key={decision}
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(
                      () => db.rpc('resolve_appeal', { appeal: a.id, decision }),
                      'Appeal decision recorded.',
                    )
                  }
                >
                  {decision === 'upheld' ? 'Uphold action' : 'Overturn action'}
                </Button>
              ))}
            </div>
          )}
        </Disclosure>
      ))}
      {!rows.loading && !rows.data.length && <Empty title="No appeals" />}
    </Section>
  );
}
function Audit() {
  const logs = useRows('audit_logs', { order: 'created_at', desc: true, limit: 100 });
  return (
    <Section title="Moderation audit log">
      <QueryState {...logs} />
      {logs.data.map((r) => (
        <div className="list-row" key={r.id}>
          <span>
            <strong>{r.action}</strong>
            <small>
              <Person id={r.actor_id} /> ·{' '}
              {dateLabel(r.created_at, { dateStyle: 'medium', timeStyle: 'short' })}
            </small>
          </span>
          <span className="chip">{r.reference?.slice(0, 12)}</span>
        </div>
      ))}
      {!logs.loading && !logs.data.length && <Empty title="No audited actions yet" />}
    </Section>
  );
}
function Settings() {
  const { db } = useWorkspace();
  const action = useAction();
  const settings = useRows('app_settings');
  const [key, setKey] = useState('announcement');
  return (
    <Section title="Application settings">
      <QueryState {...settings} />
      <Form
        key={key}
        reset={false}
        onSubmit={(d) =>
          action.run(
            () =>
              db.rpc('admin_action', {
                kind: 'settings',
                item: key,
                action: 'save',
                payload: { value: field(d, 'value') },
              }),
            'Setting published.',
          )
        }
      >
        <Select
          label="Setting"
          options={['announcement', 'guidelines_summary']}
          value={key}
          onChange={setKey}
        />
        <Area
          label="Text shown to students"
          name="value"
          defaultValue={settings.data.find((r) => r.key === key)?.value || ''}
          maxLength={500}
          required
        />
        <Button className="primary" type="submit" disabled={action.busy}>
          Save setting
        </Button>
        <Feedback {...action} />
      </Form>
    </Section>
  );
}
