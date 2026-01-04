import React, {memo, useCallback, useEffect, useState} from 'react';
import Link from '@jetbrains/ring-ui-built/components/link/link';
import Loader from '@jetbrains/ring-ui-built/components/loader/loader';
import Tag from '@jetbrains/ring-ui-built/components/tag/tag';
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
  status: 'NEW' | 'MERGED' | 'ABANDONED';
  created: string;
  updated: string;
  owner: GerritOwner | null;
  insertions: number;
  deletions: number;
  labels: Record<string, GerritLabel>;
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
 * Get status badge color based on change status
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'MERGED':
      return 'var(--ring-success-color)';
    case 'ABANDONED':
      return 'var(--ring-error-color)';
    case 'NEW':
    default:
      return 'var(--ring-main-color)';
  }
}

/**
 * Format label for display
 */
function formatLabel(name: string, label: GerritLabel): string {
  const shortName = name.replace('Code-Review', 'CR').replace('Verified', 'V');
  return `${shortName}: ${label.value}`;
}

/**
 * Get label badge style
 */
function getLabelStyle(label: GerritLabel): React.CSSProperties {
  if (label.approved) {
    return { backgroundColor: 'var(--ring-success-color)', color: 'white' };
  }
  if (label.rejected) {
    return { backgroundColor: 'var(--ring-error-color)', color: 'white' };
  }
  if (label.value === '+1') {
    return { backgroundColor: 'var(--ring-success-background-color)', color: 'var(--ring-success-color)' };
  }
  if (label.value === '-1') {
    return { backgroundColor: 'var(--ring-error-background-color)', color: 'var(--ring-error-color)' };
  }
  return {};
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins}m ago`;
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

/**
 * Single change row component
 */
const ChangeRow: React.FC<{ change: GerritChange }> = ({ change }) => {
  const labels = Object.entries(change.labels);
  
  return (
    <div className="change-row">
      <div className="change-header">
        <Link href={change.url} target="_blank" className="change-subject">
          {change.subject}
        </Link>
        <Tag 
          readOnly
          backgroundColor={getStatusColor(change.status)}
          textColor="white"
        >
          {change.status}
        </Tag>
      </div>
      
      <div className="change-meta">
        <Text info className="change-info">
          <span className="change-number">#{change.number}</span>
          <span className="separator">•</span>
          <span>{change.project}</span>
          <span className="separator">•</span>
          <span>{change.branch}</span>
          {change.owner && (
            <>
              <span className="separator">•</span>
              <span>{change.owner.name}</span>
            </>
          )}
          <span className="separator">•</span>
          <span title={change.updated}>{formatRelativeTime(change.updated)}</span>
          <span className="separator">•</span>
          <span className="diff-stats">
            <span className="insertions">+{change.insertions}</span>
            <span className="deletions">-{change.deletions}</span>
          </span>
        </Text>
      </div>
      
      {labels.length > 0 && (
        <div className="change-labels">
          {labels.map(([name, label]) => (
            <Tag 
              key={name}
              readOnly
              backgroundColor={getLabelStyle(label).backgroundColor}
              textColor={getLabelStyle(label).color}
              rgTagTitle={label.by ? `${name}: ${label.value} by ${label.by}` : `${name}: ${label.value}`}
            >
              {formatLabel(name, label)}
            </Tag>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Main widget component
 */
const AppComponent: React.FunctionComponent = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changes, setChanges] = useState<GerritChange[]>([]);
  const [query, setQuery] = useState<string>('');

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
        setQuery(result.query || '');
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

  // Render changes list
  const openChanges = changes.filter(c => c.isOpen);
  const closedChanges = changes.filter(c => !c.isOpen);

  return (
    <div className="widget">
      <div className="widget-header">
        <h3 className="widget-title">
          Gerrit Changes
          <Tag readOnly tagType={Tag.Type.MAIN}>{changes.length}</Tag>
        </h3>
      </div>
      
      {openChanges.length > 0 && (
        <div className="changes-section">
          <h4 className="section-title">Open ({openChanges.length})</h4>
          <div className="changes-list">
            {openChanges.map(change => (
              <ChangeRow key={change.number} change={change} />
            ))}
          </div>
        </div>
      )}
      
      {closedChanges.length > 0 && (
        <div className="changes-section">
          <h4 className="section-title">Closed ({closedChanges.length})</h4>
          <div className="changes-list">
            {closedChanges.map(change => (
              <ChangeRow key={change.number} change={change} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const App = memo(AppComponent);

