import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

const String PWA_URL = 'https://matylipsa-create-sen-8btq.bolt.host';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  runApp(const SentraVisionApp());
}

class SentraVisionApp extends StatelessWidget {
  const SentraVisionApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Sentra Visión',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: Colors.black,
        primaryColor: const Color(0xFF00FFCC),
      ),
      home: const SentraVisionWebView(),
    );
  }
}

class SentraVisionWebView extends StatefulWidget {
  const SentraVisionWebView({super.key});

  @override
  State<SentraVisionWebView> createState() => _SentraVisionWebViewState();
}

class _SentraVisionWebViewState extends State<SentraVisionWebView> {
  late final WebViewController _controller;
  bool _isLoading = true;
  bool _hasError = false;
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  void _initWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) {
            setState(() {
              _isLoading = true;
              _hasError = false;
            });
          },
          onPageFinished: (String url) {
            setState(() {
              _isLoading = false;
            });
            _controller.runJavaScript('''
              if (typeof window !== "undefined" && "speechSynthesis" in window) {
                const u = new SpeechSynthesisUtterance("Sentra Visión lista. Toque el botón para activar.");
                u.lang = "es-AR";
                u.rate = 1.5;
                window.speechSynthesis.speak(u);
              }
            ''');
          },
          onWebResourceError: (WebResourceError error) {
            setState(() {
              _isLoading = false;
              _hasError = true;
              _errorMessage = error.description;
            });
            _controller.runJavaScript('''
              if (typeof window !== "undefined" && "speechSynthesis" in window) {
                const u = new SpeechSynthesisUtterance("Error de conexión. Verifique internet.");
                u.lang = "es-AR";
                window.speechSynthesis.speak(u);
              }
            ''');
          },
          onPermissionRequest: (WebViewPermissionRequest request) {
            request.grant();
          },
        ),
      )
      ..loadRequest(Uri.parse(PWA_URL));

    if (_controller.platform is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(false);
      (_controller.platform as AndroidWebViewController)
          .setMediaPlaybackRequiresUserGesture(false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            WebViewWidget(controller: _controller),
            if (_isLoading)
              const Center(
                child: Semantics(
                  label: 'Cargando Sentra Visión',
                  liveRegion: true,
                  child: CircularProgressIndicator(
                    color: Color(0xFF00FFCC),
                  ),
                ),
              ),
            if (_hasError)
              Center(
                child: Semantics(
                  label: 'Error al cargar. Toque para reintentar.',
                  button: true,
                  liveRegion: true,
                  child: GestureDetector(
                    onTap: () {
                      setState(() {
                        _hasError = false;
                        _isLoading = true;
                      });
                      _controller.loadRequest(Uri.parse(PWA_URL));
                    },
                    child: Container(
                      padding: const EdgeInsets.all(32),
                      decoration: BoxDecoration(
                        color: Colors.black,
                        border: Border.all(color: const Color(0xFF00FFCC), width: 3),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.refresh,
                              color: Color(0xFF00FFCC), size: 80),
                          const SizedBox(height: 16),
                          Text(
                            'Error: $_errorMessage\n\nToque para reintentar',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
