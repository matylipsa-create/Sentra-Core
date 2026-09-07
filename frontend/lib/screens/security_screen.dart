import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/sentra_client.dart';
import '../services/state_notifier.dart';

/// Pantalla del modulo Seguridad: sincronizacion P2P + monitoreo USB.
class SecurityScreen extends StatefulWidget {
  final SentraStateNotifier notifier;
  final SentraClient client;

  const SecurityScreen({
    super.key,
    required this.notifier,
    required this.client,
  });

  @override
  State<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends State<SecurityScreen> {
  Map<String, dynamic>? _syncStatus;
  List<Map<String, dynamic>> _usbDevices = [];
  String _selectedTransport = 'offline';
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _loadSyncStatus();
    _loadUsbDevices();
    _listenPortChanges();
  }

  Future<void> _loadSyncStatus() async {
    try {
      final status = await widget.client.getRoute('sync/status');
      if (mounted) {
        setState(() {
          _syncStatus = status;
          _selectedTransport = status['transport'] as String? ?? 'offline';
        });
      }
    } catch {
      // backend no disponible
    }
  }

  Future<void> _loadUsbDevices() async {
    try {
      final resp = await widget.client.getRoute('usb/devices');
      if (mounted) {
        final devices = (resp['devices'] as List?)
                ?.map((e) => e as Map<String, dynamic>)
                .toList() ??
            [];
        setState(() => _usbDevices = devices);
      }
    } catch {
      // backend no disponible
    }
  }

  void _listenPortChanges() {
    widget.client.events
        .where((e) => e.event == 'usb.port_change')
        .listen((_) => _loadUsbDevices());
    widget.client.events
        .where((e) => e.event == 'sync.transport_changed')
        .listen((e) {
      final data = e.data as Map<String, dynamic>?;
      if (data != null && mounted) {
        setState(() => _selectedTransport = data['transport'] as String? ?? 'offline');
      }
    });
  }

  Future<void> _setTransport(String transport) async {
    setState(() => _loading = true);
    try {
      await widget.client.postRoute('sync/transport', {'transport': transport});
      if (mounted) setState(() => _selectedTransport = transport);
    } catch {
      // backend no disponible
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _connectBluetooth() async {
    setState(() => _loading = true);
    try {
      await widget.client.postRoute('sync/connect-bluetooth', {});
      await _loadSyncStatus();
    } catch {
      // backend no disponible
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _disconnectBluetooth() async {
    setState(() => _loading = true);
    try {
      await widget.client.postRoute('sync/disconnect-bluetooth', {});
      await _loadSyncStatus();
    } catch {
      // backend no disponible
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _blockPort(String portId) async {
    try {
      await widget.client.postRoute('usb/block', {'portId': portId});
      await _loadUsbDevices();
    } catch {
      // backend no disponible
    }
  }

  Future<void> _unblockPort(String portId) async {
    final confirmed = await _showVetoConfirm(portId, isInfected: false);
    if (confirmed != true) return;
    try {
      await widget.client.postRoute('usb/unblock', {'portId': portId});
      await _loadUsbDevices();
    } catch {
      // backend no disponible
    }
  }

  Future<void> _authenticateDevice(String portId) async {
    try {
      final resp = await widget.client.postRoute('usb/authenticate', {'portId': portId});
      final ok = resp['authenticated'] as bool? ?? false;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ok ? 'Dispositivo autenticado' : 'Autenticacion rechazada: defensa activada'),
            backgroundColor: ok ? SentraTheme.accent : SentraTheme.error,
          ),
        );
      }
      await _loadUsbDevices();
    } catch {
      // backend no disponible
    }
  }

  Future<dynamic> _showVetoConfirm(String portId, {required bool isInfected}) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) {
        bool checked = false;
        return StatefulBuilder(
          builder: (ctx, setState) => AlertDialog(
            backgroundColor: SentraTheme.bgCard,
            title: Text(
              isInfected ? 'Vacunar puerto' : 'Desbloquear puerto',
              style: const TextStyle(color: SentraTheme.warning, fontSize: 16),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isInfected
                      ? 'Confirmar vacunacion del puerto $portId? Esto eliminara la bacteria.'
                      : 'Confirmar desbloqueo del puerto $portId? Requiere veto humano.',
                  style: const TextStyle(color: SentraTheme.text, fontSize: 13),
                ),
                const SizedBox(height: SentraTheme.space2),
                CheckboxListTile(
                  value: checked,
                  onChanged: (v) => setState(() => checked = v ?? false),
                  title: const Text('Confirmo manualmente', style: TextStyle(fontSize: 13)),
                  activeColor: SentraTheme.warning,
                  contentPadding: EdgeInsets.zero,
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancelar'),
              ),
              ElevatedButton(
                onPressed: checked ? () => Navigator.pop(ctx, true) : null,
                child: const Text('Confirmar'),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Monitoreo de Seguridad',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: SentraTheme.textBright),
        ),
        const SizedBox(height: SentraTheme.space1),
        const Text(
          'Sincronizacion P2P y gestion de puertos USB con defensa bacteriana.',
          style: TextStyle(color: SentraTheme.textDim, fontSize: 13),
        ),
        const SizedBox(height: SentraTheme.space3),
        _buildSyncSection(),
        const SizedBox(height: SentraTheme.space3),
        _buildUsbSection(),
      ],
    );
  }

  Widget _buildSyncSection() {
    final transports = [
      {'id': 'offline', 'label': 'Offline'},
      {'id': 'syncthing', 'label': 'Syncthing'},
      {'id': 'bluetooth_mesh', 'label': 'Bluetooth Mesh'},
      {'id': 'lora', 'label': 'LoRa'},
    ];

    return Container(
      padding: const EdgeInsets.all(SentraTheme.space2),
      decoration: BoxDecoration(
        color: SentraTheme.bgCard,
        border: Border.all(color: SentraTheme.border),
        borderRadius: BorderRadius.circular(SentraTheme.radius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Sincronizacion P2P',
            style: TextStyle(color: SentraTheme.primary, fontSize: 14, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: SentraTheme.space2),
          Wrap(
            spacing: 6,
            children: transports.map((t) {
              final id = t['id']!;
              final label = t['label']!;
              final active = _selectedTransport == id;
              return ChoiceChip(
                label: Text(label),
                selected: active,
                onSelected: _loading ? null : (_) => _setTransport(id),
                selectedColor: SentraTheme.primary,
                labelStyle: TextStyle(
                  color: active ? SentraTheme.bg : SentraTheme.textDim,
                  fontSize: 12,
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: SentraTheme.space2),
          if (_syncStatus != null) ...[
            _syncInfoRow('Transporte', _syncStatus!['transport'] as String? ?? '-'),
            _syncInfoRow('Pares', '${_syncStatus!['peers']?.length ?? 0}'),
            _syncInfoRow('Pendientes', '${_syncStatus!['pendingPackets'] ?? 0}'),
            _syncInfoRow('Sincronizados', '${_syncStatus!['syncedPackets'] ?? 0}'),
            _syncInfoRow(
              'Bluetooth',
              (_syncStatus!['bluetoothConnected'] as bool?) == true ? 'Conectado' : 'Desconectado',
            ),
          ],
          if (_selectedTransport == 'bluetooth_mesh') ...[
            const SizedBox(height: SentraTheme.space2),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: _loading ? null : _connectBluetooth,
                    child: const Text('Conectar'),
                  ),
                ),
                const SizedBox(width: SentraTheme.space1),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _loading ? null : _disconnectBluetooth,
                    child: const Text('Desconectar'),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _syncInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: SentraTheme.textDim, fontSize: 12)),
          Text(value, style: const TextStyle(color: SentraTheme.primary, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _buildUsbSection() {
    return Container(
      padding: const EdgeInsets.all(SentraTheme.space2),
      decoration: BoxDecoration(
        color: SentraTheme.bgCard,
        border: Border.all(color: SentraTheme.border),
        borderRadius: BorderRadius.circular(SentraTheme.radius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Puertos USB',
            style: TextStyle(color: SentraTheme.primary, fontSize: 14, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: SentraTheme.space2),
          if (_usbDevices.isEmpty)
            const Text(
              'No hay dispositivos USB conectados.',
              style: TextStyle(color: SentraTheme.textDim, fontSize: 13),
            )
          else
            ..._usbDevices.map((dev) => _buildUsbDeviceCard(dev)),
        ],
      ),
    );
  }

  Widget _buildUsbDeviceCard(Map<String, dynamic> dev) {
    final portId = dev['portId'] as String? ?? '';
    final status = dev['portStatus'] as String? ?? 'allowed';
    final productName = dev['productName'] as String?;
    final vid = dev['vendorId'] as int?;
    final pid = dev['productId'] as int?;
    final connected = dev['connected'] as bool? ?? false;
    final authenticated = dev['authenticated'] as bool? ?? false;

    Color statusColor;
    String statusLabel;
    IconData statusIcon;
    switch (status) {
      case 'blocked':
        statusColor = SentraTheme.error;
        statusLabel = 'Bloqueado';
        statusIcon = Icons.block;
        break;
      case 'infected':
        statusColor = SentraTheme.error;
        statusLabel = 'Infectado';
        statusIcon = Icons.bug_report;
        break;
      default:
        statusColor = SentraTheme.accent;
        statusLabel = authenticated ? 'Autenticado' : 'Permitido';
        statusIcon = Icons.check_circle;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: SentraTheme.space1),
      padding: const EdgeInsets.all(SentraTheme.space2),
      decoration: BoxDecoration(
        color: SentraTheme.bgElevated,
        border: Border(
          left: BorderSide(color: statusColor, width: 3),
          top: BorderSide(color: SentraTheme.border),
          bottom: BorderSide(color: SentraTheme.border),
          right: BorderSide(color: SentraTheme.border),
        ),
        borderRadius: BorderRadius.circular(SentraTheme.radiusSm),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(statusIcon, color: statusColor, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'VID ${vid?.toRadixString(16) ?? '??'} / PID ${pid?.toRadixString(16) ?? '??'}',
                      style: const TextStyle(
                        color: SentraTheme.text,
                        fontSize: 13,
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (productName != null)
                      Text(productName, style: const TextStyle(color: SentraTheme.textDim, fontSize: 12)),
                    Text(
                      '$statusLabel${!connected ? ' · Desconectado' : ''}',
                      style: TextStyle(color: statusColor, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: SentraTheme.space1),
          Row(
            children: [
              if (status == 'allowed' && !authenticated && connected)
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => _authenticateDevice(portId),
                    style: ElevatedButton.styleFrom(minimumSize: const Size(0, 40)),
                    child: const Text('Autenticar', style: TextStyle(fontSize: 12)),
                  ),
                ),
              if (status == 'allowed' && !authenticated && connected)
                const SizedBox(width: 6),
              if (status == 'allowed')
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _blockPort(portId),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: SentraTheme.error,
                      minimumSize: const Size(0, 40),
                      side: const BorderSide(color: SentraTheme.error),
                    ),
                    child: const Text('Bloquear', style: TextStyle(fontSize: 12)),
                  ),
                ),
              if (status == 'blocked' || status == 'infected')
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => _unblockPort(portId),
                    style: ElevatedButton.styleFrom(minimumSize: const Size(0, 40)),
                    child: Text(
                      status == 'infected' ? 'Vacunar' : 'Desbloquear',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
