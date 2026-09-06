import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/state_notifier.dart';

/// Pantalla del modulo Aprendizaje.
class LearningScreen extends StatefulWidget {
  final SentraStateNotifier notifier;

  const LearningScreen({super.key, required this.notifier});

  @override
  State<LearningScreen> createState() => _LearningScreenState();
}

class _LearningScreenState extends State<LearningScreen> {
  final _controller = TextEditingController();
  bool _processing = false;

  void _submit() async {
    final question = _controller.text.trim();
    if (question.isEmpty) return;
    setState(() => _processing = true);
    await widget.notifier.processCommand(question);
    if (mounted) setState(() { _processing = false; _controller.clear(); });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.notifier.state;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Aprendizaje',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: SentraTheme.textBright),
        ),
        const SizedBox(height: SentraTheme.space1),
        const Text(
          'Haz una pregunta y recibiras una respuesta contextual.',
          style: TextStyle(color: SentraTheme.textDim, fontSize: 13),
        ),
        const SizedBox(height: SentraTheme.space2),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _controller,
                decoration: const InputDecoration(
                  hintText: 'Que quieres saber?',
                  border: OutlineInputBorder(),
                ),
                onSubmitted: (_) => _submit(),
              ),
            ),
            const SizedBox(width: SentraTheme.space1),
            ElevatedButton(
              onPressed: _processing ? null : _submit,
              child: _processing
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Preguntar'),
            ),
          ],
        ),
        const SizedBox(height: SentraTheme.space2),
        if (state.lastResponseText != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(SentraTheme.space2),
            decoration: BoxDecoration(
              color: SentraTheme.bgElevated,
              borderRadius: BorderRadius.circular(SentraTheme.radiusSm),
              border: const Border(left: BorderSide(color: SentraTheme.accent, width: 3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  (state.lastResponseSource ?? 'local').toUpperCase(),
                  style: const TextStyle(fontSize: 10, color: SentraTheme.textDim, letterSpacing: 0.5),
                ),
                const SizedBox(height: 4),
                Text(
                  state.lastResponseText!,
                  style: const TextStyle(fontSize: 14, color: SentraTheme.text, height: 1.5),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
