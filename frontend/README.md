# Sentra Core Frontend (Flutter)

UI multiplataforma para Sentra Core v4.0.0_BIO.

## Plataformas soportadas

- iOS
- Android
- Web
- Desktop (Windows, macOS, Linux)

## Requisitos

- Flutter >= 3.16.0
- Dart >= 3.2.0
- Backend Sentra Core API Server corriendo (ver `../server/`)

## Compilacion

```bash
cd frontend
flutter pub get
flutter run                    # dispositivo conectado
flutter run -d chrome          # web
flutter run -d windows         # desktop
flutter build apk              # Android
flutter build ios              # iOS
flutter build web              # Web
```

## Configuracion del backend

Por defecto el frontend se conecta a `ws://localhost:8080` y `http://localhost:8080/api`.

Cambiar las URLs con flags de compilacion:

```bash
flutter run --dart-define=SENTRA_WS_URL=ws://192.168.1.100:8080 \
            --dart-define=SENTRA_API_URL=http://192.168.1.100:8080/api
```

## Arquitectura

```
lib/
  main.dart                    Punto de entrada
  app.dart                     SentraApp (MaterialApp + tema)
  config/
    theme.dart                 Sistema de colores, tipografia, tema
    constants.dart             Constantes (URLs del backend, timeouts)
  models/
    tcrei_models.dart          Modelos TCREI (mensaje, respuesta, percepcion)
    module_def.dart            Definicion de modulo
    bio_session.dart           Sesion BioSoftware
    evidence_entry.dart        Entrada EVOLIS
    guardian_status.dart       Estado del guardian
    app_state.dart             Estado global de la app
  services/
    sentra_client.dart         Cliente WebSocket + REST
    state_notifier.dart        Gestor de estado (ChangeNotifier)
  widgets/
    voice_orb_button.dart      Orbe de voz bilateral
    accessible_header.dart     Cabecera accesible
    module_drawer.dart         Cajon tactil de modulos
    response_banner.dart       Banner de respuesta / bloqueo etico
    status_chips.dart          Chips de estado
    bio_breath_guide.dart      Guia visual de respiracion
    bio_protocol_card.dart     Tarjeta de protocolo bio
    evidence_chain_view.dart   Vista de cadena EVOLIS
    guardian_view.dart         Vista del guardian bacteriano
  screens/
    main_screen.dart           Pantalla principal (header + contenido + voz)
    bio_screen.dart            Modo bio
    evidence_screen.dart       Modo evidencia
    guardian_screen.dart       Modo guardian
    learning_screen.dart       Modo aprendizaje
    vision_screen.dart         Modo vision
    silence_screen.dart        Modo silencio
    settings_screen.dart       Configuracion
```

## Accesibilidad

- **TalkBack** (Android): Soporte nativo via Flutter Semantics
- **VoiceOver** (iOS): Soporte nativo via Flutter Semantics
- **NVDA** (Windows): Soporte via Flutter Desktop
- **ARIA** (Web): Flutter Web genera atributos ARIA
- **Contraste**: WCAG 2.1 AA (ratio >= 4.5:1)
- **Focus visible**: Outline neon de 3px
- **Tamanos tactiles**: Minimo 56dp
