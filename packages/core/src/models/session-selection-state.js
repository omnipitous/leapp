"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionSelectionState = void 0;
class SessionSelectionState {
    constructor(sessionId, isSelected, menuX, menuY, isContextualMenuOpen) {
        this.sessionId = sessionId;
        this.isSelected = isSelected;
        this.menuX = menuX;
        this.menuY = menuY;
        this.isContextualMenuOpen = isContextualMenuOpen;
    }
}
exports.SessionSelectionState = SessionSelectionState;
