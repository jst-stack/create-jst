# Architecture

`src/cli.mjs` is the composition root. It selects concrete adapters and injects them into the application service; no domain or application module imports Node file-system, process, or network APIs.

```text
CLI UI → ProjectInitializer → TemplateGateway
       ↘                  ↘ ProjectGateway
        EventBus → Reporter
```

`domain/projectSpecification.mjs` owns the immutable project model and its invariants. The command adapter maps flags and wizard answers into that model. `ProjectInitializer` is the application facade: it coordinates the workflow exclusively through `TemplateGateway`, `ProjectGateway`, and an event publisher. `degitTemplateGateway` and `nodeProjectGateway` are infrastructure implementations selected in the composition root.

The event bus is a small Publisher–Subscriber boundary for progress. It keeps rendering out of the use case and lets another frontend subscribe without changing the workflow. The template and local-project boundaries are Gateways. The specification factory is the model builder.

Dependencies flow inward only:

```text
ui / infrastructure / composition → application → domain
```

Service Locator is intentionally absent. Dependencies are explicit constructor arguments, so substitutions are visible at the composition root and straightforward in tests. The local project gateway receives only the project directory and performs no operation outside that scope.
