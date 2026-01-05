import React, {memo, useCallback, useEffect, useState} from 'react';
import Link from '@jetbrains/ring-ui-built/components/link/link';
import Loader from '@jetbrains/ring-ui-built/components/loader/loader';
import Alert, {Container as AlertContainer} from '@jetbrains/ring-ui-built/components/alert/alert';
import Text from '@jetbrains/ring-ui-built/components/text/text';

// Register widget in YouTrack. To learn more, see https://www.jetbrains.com/help/youtrack/devportal-apps/apps-host-api.html
const host = await YTApp.register();

/**
 * Types for Gerrit Change data
 */
interface GerritLabel {
  value: string;
  approved?: boolean;
  rejected?: boolean;
  by?: string;
}

interface GerritOwner {
  name: string;
  email?: string;
}

interface GerritChange {
  number: number;
  changeId: string;
  project: string;
  branch: string;
  subject: string;
  status: 'NEW' | 'MERGED' | 'ABANDONED' | 'WIP';
  created: string;
  updated: string;
  owner: GerritOwner | null;
  insertions: number;
  deletions: number;
  labels: Record<string, GerritLabel>;
  isWip: boolean;
  isOpen: boolean;
  url: string;
}

interface ApiResponse {
  changes: GerritChange[];
  error?: string;
  query?: string;
  count?: number;
}

/**
 * Get label cell content with color
 */
function getLabelDisplay(labels: Record<string, GerritLabel>, labelName: string): { text: string; className: string } {
  const label = labels[labelName];
  if (!label) return { text: '', className: '' };
  
  const value = label.value;
  if (label.approved || value === '+2') {
    return { text: value, className: 'label-approved' };
  }
  if (label.rejected || value === '-2') {
    return { text: value, className: 'label-rejected' };
  }
  if (value === '+1') {
    return { text: value, className: 'label-positive' };
  }
  if (value === '-1') {
    return { text: value, className: 'label-negative' };
  }
  return { text: value || '0', className: 'label-neutral' };
}

/**
 * Get status icon and color
 */
function getStatusDisplay(status: string): { icon: string; className: string; text: string } {
  switch (status) {
    case 'MERGED':
      return { icon: '✓', className: 'status-merged', text: 'Merged' };
    case 'ABANDONED':
      return { icon: '✗', className: 'status-abandoned', text: 'Abandoned' };
    case 'WIP':
      return { icon: '◐', className: 'status-wip', text: 'Work in Progress' };
    case 'NEW':
    default:
      return { icon: '○', className: 'status-new', text: 'Open' };
  }
}

/**
 * Main widget component
 */
const AppComponent: React.FunctionComponent = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<GerritChange[]>([]);

  const fetchChanges = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result: ApiResponse = await host.fetchApp('gerrit-api/changes', { scope: true });
      
      if (result.error) {
        setError(result.error);
        setChanges([]);
      } else {
        setChanges(result.changes || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch changes');
      setChanges([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChanges();
  }, [fetchChanges]);

  // Loading state
  if (loading) {
    return (
      <div className="widget widget-loading">
        <Loader message="Loading Gerrit changes..." />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="widget widget-error">
        <AlertContainer>
          <Alert type={Alert.Type.ERROR} closeable={false}>
            {error}
          </Alert>
        </AlertContainer>
      </div>
    );
  }

  // No changes found
  if (changes.length === 0) {
    return (
      <div className="widget widget-empty">
        <Text info>No Gerrit changes found for this issue</Text>
      </div>
    );
  }

  // Split changes by status
  const openChanges = changes.filter(c => c.isOpen);
  const closedChanges = changes.filter(c => !c.isOpen);

  // Collect all unique label names across all changes
  const allLabelNames = new Set<string>();
  changes.forEach(c => Object.keys(c.labels).forEach(l => allLabelNames.add(l)));
  const labelColumns = Array.from(allLabelNames).map(name => ({
    name,
    short: name.replace('Code-Review', 'CR').replace('Verified', 'V').replace('Coding-Style', 'CS')
  }));

  const renderTable = (changeList: GerritChange[], title: string) => {
    if (changeList.length === 0) return null;
    
    return (
      <div className="changes-section">
        <div className="section-header">
          <span className="section-title">{title}</span>
          <span className="section-count">({changeList.length})</span>
        </div>
        <table className="changes-table">
          <thead>
            <tr>
              <th className="col-status">Status</th>
              <th className="col-subject">Subject</th>
              <th className="col-project">Project</th>
              <th className="col-branch">Branch</th>
              {labelColumns.map(lc => (
                <th key={lc.name} className="col-label" title={lc.name}>{lc.short}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {changeList.map(change => {
              const status = getStatusDisplay(change.status);
              return (
                <tr key={change.number} className="change-row">
                  <td className={`col-status ${status.className}`} title={status.text}>
                    <span className="status-icon">{status.icon}</span>
                  </td>
                  <td className="col-subject">
                    <Link href={change.url} target="_blank" title={change.subject}>
                      {change.subject}
                    </Link>
                  </td>
                  <td className="col-project" title={change.project}>{change.project}</td>
                  <td className="col-branch" title={change.branch}>{change.branch}</td>
                  {labelColumns.map(lc => {
                    const ld = getLabelDisplay(change.labels, lc.name);
                    return (
                      <td key={lc.name} className="col-label">
                        {ld.text && <span className={ld.className}>{ld.text}</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="widget">
      {renderTable(openChanges, 'Open')}
      {renderTable(closedChanges, 'Closed')}
    </div>
  );
};

export const App = memo(AppComponent);

