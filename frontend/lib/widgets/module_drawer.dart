import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/module_def.dart';

/// Cajon tactil de modulos que se desliza desde abajo (bottom sheet).
class ModuleDrawer extends StatelessWidget {
  final List<ModuleDef> modules;
  final String activeModuleId;
  final ValueChanged<String> onSelect;

  const ModuleDrawer({
    super.key,
    required this.modules,
    required this.activeModuleId,
    required this.onSelect,
  });

  static void show(
    BuildContext context, {
    required List<ModuleDef> modules,
    required String activeModuleId,
    required ValueChanged<String> onSelect,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: SentraTheme.bgCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(SentraTheme.radius)),
      ),
      builder: (_) => ModuleDrawer(
        modules: modules,
        activeModuleId: activeModuleId,
        onSelect: onSelect,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Menu de modulos',
      child: Padding(
        padding: const EdgeInsets.all(SentraTheme.space2),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: SentraTheme.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: SentraTheme.space2),
            const Text(
              'Modulos',
              style: TextStyle(
                color: SentraTheme.neonFocus,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: SentraTheme.space2),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: modules.length,
                itemBuilder: (context, index) {
                  final mod = modules[index];
                  final isActive = mod.id == activeModuleId;
                  return _ModuleTile(
                    module: mod,
                    isActive: isActive,
                    onTap: () {
                      onSelect(mod.id);
                      Navigator.pop(context);
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ModuleTile extends StatelessWidget {
  final ModuleDef module;
  final bool isActive;
  final VoidCallback onTap;

  const _ModuleTile({
    required this.module,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: isActive,
      label: 'Modulo ${module.label}. ${module.description}',
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(SentraTheme.radius),
        child: Container(
          margin: const EdgeInsets.only(bottom: SentraTheme.space1),
          padding: const EdgeInsets.symmetric(
            horizontal: SentraTheme.space2,
            vertical: SentraTheme.space1 + 4,
          ),
          decoration: BoxDecoration(
            color: SentraTheme.bgElevated,
            borderRadius: BorderRadius.circular(SentraTheme.radius),
            border: Border.all(
              color: isActive ? SentraTheme.neonFocus : SentraTheme.border,
            ),
            boxShadow: isActive
                ? [BoxShadow(color: SentraTheme.neonFocus.withValues(alpha: 0.08), blurRadius: 0)]
                : null,
          ),
          child: Row(
            children: [
              if (isActive)
                Container(width: 3, height: 40, color: SentraTheme.neonFocus),
              if (isActive) const SizedBox(width: 12),
              if (!isActive) const SizedBox(width: 3 + 12),
              Text(module.icon, style: const TextStyle(fontSize: 24)),
              const SizedBox(width: SentraTheme.space2),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      module.label,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: isActive ? SentraTheme.textBright : SentraTheme.text,
                      ),
                    ),
                    Text(
                      module.description,
                      style: const TextStyle(
                        fontSize: 12,
                        color: SentraTheme.textDim,
                        height: 1.3,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
