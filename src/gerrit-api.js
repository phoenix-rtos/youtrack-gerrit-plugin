/**
 * Gerrit API HTTP Handler
 * 
 * Provides endpoints for querying Gerrit Code Review from the widget.
 * Uses YouTrack's HTTP module to make authenticated requests to Gerrit REST API.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
var http = require('@jetbrains/youtrack-scripting-api/http');

/**
 * Parse Gerrit JSON response (removes the XSSI protection prefix)
 * @param {string} responseText - Raw response text from Gerrit
 * @returns {any} Parsed JSON object
 */
function parseGerritResponse(responseText) {
    // Gerrit REST responses start with )]}'  to prevent XSSI
    const jsonText = responseText.replace(/^\)\]\}'\n?/, '');
    return JSON.parse(jsonText);
}

/**
 * Build search query from pattern and issue ID
 * @param {string} pattern - Query pattern with %s placeholder
 * @param {string} issueId - Issue ID to search for
 * @returns {string} Formatted query
 */
function buildQuery(pattern, issueId) {
    const queryPattern = pattern || 'message:%s';
    return queryPattern.replace(/%s/g, issueId);
}

/**
 * Format a numeric vote value with sign prefix
 * @param {number} value - Numeric label value
 * @returns {string} Formatted value with sign (e.g., "+1", "-2", "0")
 */
function formatVoteValue(value) {
    if (value > 0) {
        return '+' + value;
    }
    return String(value);
}

/**
 * Check if vote should replace current best vote
 * @param {number} absValue - Absolute value of vote
 * @param {number} bestAbsValue - Current best absolute value
 * @param {Object} vote - Current vote object
 * @param {Object} bestVote - Current best vote object
 * @returns {boolean} True if vote should replace best
 */
function shouldReplaceVote(absValue, bestAbsValue, vote, bestVote) {
    if (absValue > bestAbsValue) {
        return true;
    }
    // On tie, prefer positive over negative
    if (absValue === bestAbsValue && vote.value > 0) {
        if (bestVote === null || bestVote.value < 0) {
            return true;
        }
    }
    return false;
}

/**
 * Find the most significant vote from the all array
 * Returns the vote with highest absolute value (max positive or min negative)
 * @param {Array} allVotes - Array of ApprovalInfo objects with value and name
 * @returns {{value: number, name: string}|null} The most significant vote or null
 */
function findMostSignificantVote(allVotes) {
    var bestVote = null;
    var bestAbsValue = -1;

    if (!allVotes || allVotes.length === 0) {
        return null;
    }
    
    allVotes.forEach(function processVote(vote) {
        var absValue;
        if (vote.value === undefined || vote.value === null) {
            return;
        }
        absValue = Math.abs(vote.value);
        if (shouldReplaceVote(absValue, bestAbsValue, vote, bestVote)) {
            bestAbsValue = absValue;
            bestVote = vote;
        }
    });
    
    return bestVote;
}

/**
 * Process a single label and extract vote information
 * @param {Object} label - Label info object from Gerrit
 * @returns {Object} Processed label with value, approved, rejected, by fields
 */
function processLabel(label) {
    var significantVote = findMostSignificantVote(label.all);
    var value;
    var voterName;
    var isApproved;
    var isRejected;
    
    if (significantVote && significantVote.value !== 0) {
        value = significantVote.value;
        voterName = significantVote.name || significantVote.username || 'Unknown';
        //console.log('Label processed:', label, 'IsApproved:', Boolean(label.approved), 'IsRejected:', Boolean(label.rejected));

        return {
            value: formatVoteValue(value),
            approved: Boolean(label.approved),
            rejected: Boolean(label.rejected),
            by: voterName
        };
    }
    return { value: '0' };
}

/**
 * Extract relevant fields from Gerrit ChangeInfo
 * @param {Object} change - Gerrit ChangeInfo object
 * @param {string} gerritUrl - Base Gerrit URL for building links
 * @returns {Object} Simplified change object for frontend
 */
function formatChange(change, gerritUrl) {
    var labels = {};
    var isWip;
    var effectiveStatus;
    
    // Extract label values from Gerrit's label info
    // With LABELS, we get the 'all' array containing actual votes
    if (change.labels) {
        Object.keys(change.labels).forEach(function processLabelEntry(labelName) {
            labels[labelName] = processLabel(change.labels[labelName]);
        });
    }

    // Determine effective status (WIP is a sub-state of NEW)
    isWip = change.work_in_progress === true;
    effectiveStatus = change.status;
    if (change.status === 'NEW' && isWip) {
        effectiveStatus = 'WIP';
    }

    return {
        number: change._number,
        changeId: change.change_id,
        project: change.project,
        branch: change.branch,
        subject: change.subject,
        status: effectiveStatus,
        created: change.created,
        updated: change.updated,
        owner: change.owner ? {
            name: change.owner.name || change.owner.username,
            email: change.owner.email
        } : null,
        insertions: change.insertions || 0,
        deletions: change.deletions || 0,
        labels: labels,
        isWip: isWip,
        isOpen: change.status === 'NEW',
        url: gerritUrl.replace(/\/$/, '') + '/c/' + change.project + '/+/' + change._number
    };
}

/**
 * HTTP connection timeout in milliseconds
 */
var HTTP_TIMEOUT = 2000;

/**
 * Query Gerrit for changes related to an issue
 * @param {Object} settings - Plugin settings
 * @param {string} issueId - Issue ID to search for
 * @returns {Object} Result with changes array or error
 */
function queryGerritChanges(settings, issueId) {
    var gerritUrl = settings.gerritUrl;
    var username = settings.gerritUsername;
    var password = settings.gerritPassword;
    var searchQuery = settings.searchQuery;
    var connection;
    var query;
    var params;
    var response;
    var changes;
    var formattedChanges;

    if (!gerritUrl || !username || !password) {
        return {
            error: 'Gerrit connection not configured. Please configure the plugin settings.',
            changes: []
        };
    }

    try {
        connection = new http.Connection(gerritUrl, null, HTTP_TIMEOUT);
        connection.basicAuth(username, password);

        query = buildQuery(searchQuery, issueId);
        
        // Build query parameters
        // Options: LABELS (includes 'all' array with actual votes), DETAILED_ACCOUNTS (reviewer names), SUBMIT_REQUIREMENTS (per-label approval status)
        params = {
            q: query,
            o: ['LABELS', 'SUBMIT_REQUIREMENTS', 'DETAILED_ACCOUNTS']
        };

        // Make the request to Gerrit
        response = connection.getSync('/a/changes/', params);

        if (!response.isSuccess) {
            return {
                error: 'Failed to query Gerrit: HTTP ' + response.code,
                changes: []
            };
        }

        changes = parseGerritResponse(response.response);
        
        // Format each change for the frontend
        formattedChanges = changes.map(function formatChangeEntry(change) {
            return formatChange(change, gerritUrl);
        });

        // Sort by updated date (most recent first)
        formattedChanges.sort(function compareUpdated(a, b) {
            return new Date(b.updated) - new Date(a.updated);
        });

        return {
            changes: formattedChanges,
            query: query,
            count: formattedChanges.length
        };

    } catch (e) {
        return {
            error: 'Error querying Gerrit: ' + e.message,
            changes: []
        };
    }
}

// eslint-disable-next-line func-names
exports.httpHandler = {
    endpoints: [
        {
            method: 'GET',
            path: '/changes',
            scope: 'issue',
            // eslint-disable-next-line func-names
            handle: function(ctx) {
                var issueId = ctx.issue.id;
                var settings = ctx.settings;
                var result = queryGerritChanges(settings, issueId);
                
                ctx.response.json(result);
            }
        }
    ]
};
