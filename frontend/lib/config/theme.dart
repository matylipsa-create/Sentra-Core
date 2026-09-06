import 'package:flutter/material.dart';

/// Sistema de colores, tipografia y tema para Sentra Core.
///
/// Paleta inspirada en el UI existente: cyan/neon sobre fondo oscuro,
/// con verde acecent para Bio y rojo para alertas/Veto.
class SentraTheme {
  SentraTheme._();

  // Colores primarios
  static const Color primary = Color(0xFF00D4FF);
  static const Color primaryDark = Color(0xFF0099CC);
  static const Color primaryLight = Color(0xFF66E5FF);

  // Acento
  static const Color accent = Color(0xFF00FF88);
  static const Color accentDark = Color(0xFF00CC66);

  // Estados
  static const Color warning = Color(0xFFFFAA00);
  static const Color error = Color(0xFFFF4444);
  static const Color success = Color(0xFF00FF88);

  // Neon focus
  static const Color neonFocus = Color(0xFF00FFCC);

  // Fondos
  static const Color bg = Color(0xFF0A0A0F);
  static const Color bgCard = Color(0xFF12121A);
  static const Color bgElevated = Color(0xFF1A1A2E);

  // Bordes
  static const Color border = Color(0xFF2A2A3E);

  // Texto
  static const Color text = Color(0xFFE8E8F0);
  static const Color textDim = Color(0xFF8888A0);
  static const Color textBright = Color(0xFFFFFFFF);

  // Espaciado (sistema 8px)
  static const double space1 = 8;
  static const double space2 = 16;
  static const double space3 = 24;
  static const double space4 = 32;

  // Radios
  static const double radius = 12;
  static const double radiusSm = 8;

  static ThemeData get darkTheme => ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: bg,
        colorScheme: const ColorScheme.dark(
          primary: primary,
          secondary: accent,
          surface: bgCard,
          error: error,
          onPrimary: bg,
          onSecondary: bg,
          onSurface: text,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: bgElevated,
          surfaceTintColor: Colors.transparent,
          foregroundColor: textBright,
          elevation: 0,
          centerTitle: true,
        ),
        cardTheme: CardThemeData(
          color: bgCard,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radius),
            side: const BorderSide(color: border),
          ),
          margin: EdgeInsets.zero,
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: bgElevated,
            foregroundColor: text,
            minimumHeight: SentraTheme.space4 + SentraTheme.space2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(radiusSm),
              side: const BorderSide(color: border),
            ),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: primary,
            minimumHeight: SentraTheme.space4 + SentraTheme.space2,
            side: const BorderSide(color: primaryDark),
          ),
        ),
        textTheme: const TextTheme(
          headlineSmall: TextStyle(
            color: textBright,
            fontSize: 20,
            fontWeight: FontWeight.w700,
            height: 1.2,
          ),
          titleLarge: TextStyle(
            color: text,
            fontSize: 18,
            fontWeight: FontWeight.w600,
            height: 1.2,
          ),
          bodyLarge: TextStyle(
            color: text,
            fontSize: 16,
            height: 1.5,
          ),
          bodyMedium: TextStyle(
            color: text,
            fontSize: 14,
            height: 1.5,
          ),
          bodySmall: TextStyle(
            color: textDim,
            fontSize: 12,
            height: 1.5,
          ),
          labelSmall: TextStyle(
            color: textDim,
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
        ),
        dividerTheme: const DividerThemeData(
          color: border,
          thickness: 1,
          space: 1,
        ),
        focusColor: neonFocus.withValues(alpha: 0.15),
      );
}
