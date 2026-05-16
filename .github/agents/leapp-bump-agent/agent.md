# leapp-bump-agent

Scopo
- Automatizzare bump periodici (non locali) delle dipendenze per `packages/core`.
- Comportamento mirato: un aggiornamento alla volta, eseguire build+test, generare changelog e aprire PR verso il ramo `willy`.

Cosa contiene
- `run-bump.sh`: script che seleziona un singolo pacchetto semver-safe (stesso major), installa la nuova versione in `packages/core`, esegue `build` e `test`, e genera un file changelog sotto `changelogs/`.
- `dependency-bump.yml` (workflow): programma lo script su schedule (configurabile) e crea automaticamente una PR se ci sono modifiche.

Perché ha senso
- Se vuoi eseguire bump periodici NON da locale, GitHub Actions è l'approccio più affidabile.
- Alternative: Dependabot o Renovate sono più robuste per aggiornamenti continui su molte dipendenze; tuttavia non eseguono logiche custom (es. test + changelog + target branch `willy`) senza configurazioni aggiuntive.

Note operative
- Il workflow usa il `GITHUB_TOKEN` disponibile nell'ambiente Actions per creare PR verso `willy`.
- La logica dello script è volutamente conservativa: seleziona un candidato con lo stesso major (quando possibile) per ridurre i breaking changes.
- Puoi modificare la schedulazione in `.github/workflows/dependency-bump.yml` o cambiare il ramo target impostando `TARGET_BRANCH` nel job.

Limitazioni
- Questo approccio esegue un solo bump per run (design del requisito). Per aggiornamenti bulk, preferire Renovate/Dependabot.

Come procedere
- Posso eseguire un dry-run locale qui nel repository oppure creare una branch e aprire una PR con questi file.
