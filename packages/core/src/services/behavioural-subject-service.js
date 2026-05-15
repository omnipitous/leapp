"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BehaviouralSubjectService = void 0;
const rxjs_1 = require("rxjs");
const session_selection_state_1 = require("../models/session-selection-state");
class BehaviouralSubjectService {
    constructor(repository) {
        this.repository = repository;
        this.sessions$ = new rxjs_1.BehaviorSubject([]);
        this.integrations$ = new rxjs_1.BehaviorSubject([]);
        this.sessionSelections$ = new rxjs_1.BehaviorSubject([]);
        this.fetchingIntegrationState$ = new rxjs_1.BehaviorSubject(undefined);
        this.reloadSessionsAndIntegrationsFromRepository();
    }
    // the getter will return the last value emitted in _sessions subject
    get sessions() {
        return this.sessions$.getValue();
    }
    // assigning a value to this.sessions will push it onto the observable
    // and down to all of its subscribers (ex: this.sessions = [])
    set sessions(sessions) {
        const sessionIds = new Set(sessions.map((session) => session.sessionId));
        this.sessionSelections = this.sessionSelections.filter((sessionSelection) => sessionIds.has(sessionSelection.sessionId));
        this.sessions$.next(sessions);
    }
    getSessionById(sessionId) {
        return this.sessions.find((s) => s.sessionId === sessionId);
    }
    getSessions() {
        return this.sessions;
    }
    setSessions(sessions) {
        this.sessions = [...sessions];
    }
    get integrations() {
        return this.integrations$.getValue();
    }
    set integrations(integrations) {
        this.integrations$.next(integrations);
    }
    getIntegrations() {
        return this.integrations;
    }
    getIntegrationById(integrationId) {
        return this.integrations.find((i) => i.id === integrationId);
    }
    setIntegrations(integrations) {
        this.integrations = integrations;
    }
    get sessionSelections() {
        return this.sessionSelections$.getValue();
    }
    set sessionSelections(sessionSelections) {
        this.sessionSelections$.next(sessionSelections);
    }
    // TODO: add tests
    selectSession(sessionId) {
        const sessionSelections = [new session_selection_state_1.SessionSelectionState(sessionId, true, null, null, false)];
        this.sessionSelections = sessionSelections;
    }
    // TODO: add tests
    openContextualMenu(sessionId, menuX, menuY) {
        const sessionSelections = [new session_selection_state_1.SessionSelectionState(sessionId, true, menuX, menuY, true)];
        this.sessionSelections = sessionSelections;
    }
    // TODO: add tests
    unselectSessions() {
        this.sessionSelections = [];
    }
    reloadSessionsAndIntegrationsFromRepository() {
        this.sessions = this.repository.getSessions();
        this.integrations = [...this.repository.listAwsSsoIntegrations(), ...this.repository.listAzureIntegrations()];
    }
    setFetchingIntegrations(fetchingState) {
        this.fetchingIntegrationState$.next(fetchingState);
    }
}
exports.BehaviouralSubjectService = BehaviouralSubjectService;
