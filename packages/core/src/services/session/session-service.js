"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionService = void 0;
const session_status_1 = require("../../models/session-status");
class SessionService {
    constructor(sessionNotifier, repository) {
        this.sessionNotifier = sessionNotifier;
        this.repository = repository;
    }
    sessionDeactivated(sessionId) {
        const sessions = this.repository.getSessions();
        const index = sessions.findIndex((s) => s.sessionId === sessionId);
        if (index > -1) {
            const currentSession = sessions[index];
            currentSession.status = session_status_1.SessionStatus.inactive;
            currentSession.startDateTime = undefined;
            sessions[index] = currentSession;
            this.repository.updateSessions(sessions);
            if (this.sessionNotifier) {
                this.sessionNotifier?.setSessions([...sessions]);
            }
        }
    }
    isInactive(sessionId) {
        const sessions = this.repository.getSessions();
        const awsSession = sessions.find((session) => session.sessionId === sessionId);
        return awsSession.status === session_status_1.SessionStatus.inactive;
    }
    sessionActivated(sessionId, sessionTokenExpiration) {
        const sessions = this.repository.getSessions();
        const index = sessions.findIndex((s) => s.sessionId === sessionId);
        if (index > -1) {
            const currentSession = sessions[index];
            currentSession.startDateTime = new Date().toISOString();
            currentSession.status = session_status_1.SessionStatus.active;
            if (sessionTokenExpiration) {
                currentSession.sessionTokenExpiration = sessionTokenExpiration;
            }
            sessions[index] = currentSession;
            this.repository.updateSessions(sessions);
            if (this.sessionNotifier) {
                this.sessionNotifier.setSessions([...sessions]);
            }
        }
    }
    sessionLoading(sessionId) {
        const sessions = this.repository.getSessions();
        const index = sessions.findIndex((s) => s.sessionId === sessionId);
        if (index > -1) {
            const currentSession = sessions[index];
            currentSession.status = session_status_1.SessionStatus.pending;
            sessions[index] = currentSession;
            this.repository.updateSessions(sessions);
            if (this.sessionNotifier) {
                this.sessionNotifier.setSessions([...sessions]);
            }
        }
    }
    sessionError(sessionId, error) {
        this.sessionDeactivated(sessionId);
        throw error;
    }
}
exports.SessionService = SessionService;
