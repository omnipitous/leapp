import { SessionFactory } from "./session-factory";
import { Repository } from "./repository";

export class RotationService {
  constructor(private sessionServiceFactory: SessionFactory, private repository: Repository) {}

  rotate(): void {
    const activeSessions = this.repository.listActive();
    activeSessions.forEach((session) => {
      if (session.expired()) {
        const concreteSessionService = this.sessionServiceFactory.getSessionService(session.type);
        // A failed rotation already deactivates the session visibly (sessionError); an unhandled
        // rejection here would surface as a spurious global error toast per session per tick
        concreteSessionService.rotate(session.sessionId).catch((_) => {});
      }
    });
  }
}
