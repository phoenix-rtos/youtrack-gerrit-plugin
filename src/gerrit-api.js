/**
 * Gerrit API HTTP Handler
 * 
 * Provides endpoints for querying Gerrit Code Review from the widget.
 * Uses YouTrack's HTTP module to make authenticated requests to Gerrit REST API.
 */

const http = require('@jetbrains/youtrack-scripting-api/http');

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
 * Extract relevant fields from Gerrit ChangeInfo
 * @param {Object} change - Gerrit ChangeInfo object
 * @param {string} gerritUrl - Base Gerrit URL for building links
 * @returns {Object} Simplified change object for frontend
 */
function formatChange(change, gerritUrl) {
    const labels = {};
    
    // Extract label values (e.g., Code-Review: +2)
    if (change.labels) {
        Object.keys(change.labels).forEach(function(labelName) {
            const label = change.labels[labelName];
            if (label.approved) {
                labels[labelName] = { value: '+2', approved: true, by: label.approved.name };
            } else if (label.recommended) {
                labels[labelName] = { value: '+1', by: label.recommended.name };
            } else if (label.disliked) {
                labels[labelName] = { value: '-1', by: label.disliked.name };
            } else if (label.rejected) {
                labels[labelName] = { value: '-2', rejected: true, by: label.rejected.name };
            } else {
                labels[labelName] = { value: '0' };
            }
        });
    }

    // Determine effective status (WIP is a sub-state of NEW)
    var isWip = change.work_in_progress === true;
    var effectiveStatus = change.status;
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
 * Query Gerrit for changes related to an issue
 * @param {Object} settings - Plugin settings
 * @param {string} issueId - Issue ID to search for
 * @returns {Object} Result with changes array or error
 */
function queryGerritChanges(settings, issueId) {
    const gerritUrl = settings.gerritUrl;
    const username = settings.gerritUsername;
    const password = settings.gerritPassword;
    const searchQuery = settings.searchQuery;

    if (!gerritUrl || !username || !password) {
        return {
            error: 'Gerrit connection not configured. Please configure the plugin settings.',
            changes: []
        };
    }

    try {
        const connection = new http.Connection(gerritUrl, null, 2000);
        connection.basicAuth(username, password);

        const query = buildQuery(searchQuery, issueId);
        
        // Build query parameters
        // Options: CURRENT_REVISION (patch set), LABELS (approvals), DETAILED_ACCOUNTS (reviewer names)
        const params = {
            q: query,
            o: ['LABELS', 'DETAILED_ACCOUNTS']
        };

        // Make the request to Gerrit
        const response = connection.getSync('/a/changes/', params);

        if (!response.isSuccess) {
            console.log('Gerrit API error: ' + response.code + ' - ' + response.response);
            return {
                error: 'Failed to query Gerrit: HTTP ' + response.code,
                changes: []
            };
        }

        const changes = parseGerritResponse(response.response);
        
        // Format each change for the frontend
        const formattedChanges = changes.map(function(change) {
            return formatChange(change, gerritUrl);
        });

        // Sort by updated date (most recent first)
        formattedChanges.sort(function(a, b) {
            return new Date(b.updated) - new Date(a.updated);
        });

        return {
            changes: formattedChanges,
            query: query,
            count: formattedChanges.length
        };

    } catch (e) {
        console.log('Gerrit query error: ' + e.message);
        return {
            error: 'Error querying Gerrit: ' + e.message,
            changes: []
        };
    }
}

exports.httpHandler = {
    endpoints: [
        {
            method: 'GET',
            path: '/changes',
            scope: 'issue',
            handle: function(ctx) {
                const issueId = ctx.issue.id;
                const settings = ctx.settings;

                console.log('Querying Gerrit for issue: ' + issueId);
                
                const result = queryGerritChanges(settings, issueId);
                
                ctx.response.json(result);
            }
        }
    ]
};
