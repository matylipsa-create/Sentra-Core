import 'package:flutter/material.dart';
import '../config/theme.dart';

/// Estado visual del orbe de voz.
enum VoiceOrbState { idle, listening, speaking, disabled }

/// Orbe de voz bilateral para Sentra Core.
///
/// Boton circular con animaciones de ondas concéntricas que reflejan
/// el estado de escucha / habla / deshabilitado.
class VoiceOrbButton extends StatefulWidget {
  final VoiceOrbState state;
  final String label;
  final VoidCallback onTap;
  final VoidCallback? onDoubleTap;

  const VoiceOrbButton({
    super.key,
    required this.state,
    required this.label,
    required this.onTap,
    this.onDoubleTap,
  });

  @override
  State<VoiceOrbButton> createState() => _VoiceOrbButtonState();
}

class _VoiceOrbButtonState extends State<VoiceOrbButton>
    with TickerProviderStateMixin {
  late AnimationController _pulseController;
  late AnimationController _ringController;
  late Animation<double> _pulseAnim;
  late Animation<double> _ringAnim;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );
    _ringController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );
    _pulseAnim = Tween<double>(begin: 1.0, end: 1.08).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
    _ringAnim = Tween<double>(begin: 0.6, end: 0.0).animate(
      CurvedAnimation(parent: _ringController, curve: Curves.easeOut),
    );
    _updateAnimations();
  }

  @override
  void didUpdateWidget(VoiceOrbButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.state != widget.state) _updateAnimations();
  }

  void _updateAnimations() {
    switch (widget.state) {
      case VoiceOrbState.listening:
        _pulseController.repeat(reverse: true);
        _ringController.repeat();
        break;
      case VoiceOrbState.speaking:
        _pulseController.repeat(reverse: true);
        _ringController.repeat();
        break;
      case VoiceOrbState.idle:
      case VoiceOrbState.disabled:
        _pulseController.stop();
        _ringController.stop();
        break;
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _ringController.dispose();
    super.dispose();
  }

  Color get _orbColor {
    switch (widget.state) {
      case VoiceOrbState.listening:
        return SentraTheme.error;
      case VoiceOrbState.speaking:
        return SentraTheme.accent;
      case VoiceOrbState.disabled:
        return SentraTheme.bgElevated;
      case VoiceOrbState.idle:
        return SentraTheme.neonFocus;
    }
  }

  Color get _orbColorDark {
    switch (widget.state) {
      case VoiceOrbState.listening:
        return const Color(0xFFFF6688);
      case VoiceOrbState.speaking:
        return SentraTheme.accentDark;
      case VoiceOrbState.disabled:
        return SentraTheme.bgCard;
      case VoiceOrbState.idle:
        return SentraTheme.primaryDark;
    }
  }

  String get _orbIcon {
    switch (widget.state) {
      case VoiceOrbState.listening:
        return '\u{1F3A4}';
      case VoiceOrbState.speaking:
        return '\u{1F50A}';
      case VoiceOrbState.disabled:
        return '\u{1F507}';
      case VoiceOrbState.idle:
        return '\u{1F5E3}';
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = SentraConstants.orbSize.toDouble();

    return Semantics(
      button: true,
      label: widget.label,
      hint: 'Toca para hablar, doble toque para activar o desactivar voz',
      child: GestureDetector(
        onTap: widget.onTap,
        onDoubleTap: widget.onDoubleTap,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: size + 40,
              height: size + 40,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Animated rings
                  if (widget.state == VoiceOrbState.listening ||
                      widget.state == VoiceOrbState.speaking) ...[
                    _buildRing(0),
                    _buildRing(0.6),
                    _buildRing(1.2),
                  ],
                  // Orb
                  AnimatedBuilder(
                    animation: _pulseAnim,
                    builder: (context, child) {
                      return Transform.scale(
                        scale: _pulseAnim.value,
                        child: child,
                      );
                    },
                    child: Container(
                      width: size,
                      height: size,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [_orbColor, _orbColorDark],
                          center: const Alignment(-0.3, -0.3),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: _orbColor.withValues(alpha: 0.4),
                            blurRadius: 24,
                            spreadRadius: 0,
                          ),
                        ],
                        border: widget.state == VoiceOrbState.disabled
                            ? Border.all(color: SentraTheme.border)
                            : null,
                      ),
                      child: Center(
                        child: Text(
                          _orbIcon,
                          style: TextStyle(
                            fontSize: size * 0.25,
                            color: widget.state == VoiceOrbState.disabled
                                ? SentraTheme.textDim
                                : SentraTheme.bg,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            Text(
              widget.label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: SentraTheme.textDim,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRing(double delaySeconds) {
    return AnimatedBuilder(
      animation: _ringAnim,
      builder: (context, child) {
        final value = (_ringAnim.value + delaySeconds) % 1.0;
        return Transform.scale(
          scale: 1.0 + (1.0 - value) * 1.2,
          child: Opacity(
            opacity: value,
            child: Container(
              width: SentraConstants.orbSize.toDouble(),
              height: SentraConstants.orbSize.toDouble(),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: _orbColor.withValues(alpha: 0.6),
                  width: 2,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
