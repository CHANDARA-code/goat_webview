package android.webkit;

import android.content.Context;
import android.view.ViewGroup;

public class WebView extends ViewGroup {
    private Context context;
    private WebViewClient client;
    private WebChromeClient chromeClient;
    private DownloadListener downloadListener;
    private WebSettings settings = new WebSettings();

    public static Object getFactory() {
        return null;
    }

    public WebView(Context context) {
        super(context);
        this.context = context;
    }

    @Override
    public Context getContext() {
        return this.context;
    }

    public void setWebViewClient(WebViewClient client) {
        this.client = client;
    }

    public WebViewClient getWebViewClient() {
        return this.client != null ? this.client : new WebViewClient();
    }

    public void setWebChromeClient(WebChromeClient client) {
        this.chromeClient = client;
    }

    public WebChromeClient getWebChromeClient() {
        return this.chromeClient;
    }

    public void setDownloadListener(DownloadListener listener) {
        this.downloadListener = listener;
    }

    public DownloadListener getDownloadListener() {
        return this.downloadListener;
    }

    public WebSettings getSettings() {
        return this.settings;
    }

    public String lastLoadedUrl = null;
    public String lastData = null;
    public String lastBaseUrl = null;
    public boolean isDestroyed = false;

    public void stopLoading() {}
    public void loadUrl(String url) {
        this.lastLoadedUrl = url;
    }
    public void loadDataWithBaseURL(String baseUrl, String data, String mimeType, String encoding, String historyUrl) {
        this.lastBaseUrl = baseUrl;
        this.lastData = data;
    }
    public void clearHistory() {}
    public void clearCache(boolean includeDisk) {}
    public void clearSslPreferences() {}
    public void destroy() {
        this.isDestroyed = true;
    }
    public void pauseTimers() {}
    public void resumeTimers() {}
    public void onPause() {}
    public void onResume() {}
    public void freeMemory() {}
    public static java.util.function.BiConsumer<String, ValueCallback<String>> customEvaluateJavascript = null;

    public void evaluateJavascript(String script, ValueCallback<String> callback) {
        if (customEvaluateJavascript != null) {
            customEvaluateJavascript.accept(script, callback);
            return;
        }
        if (callback != null) {
            callback.onReceiveValue("\"mock_result\"");
        }
    }
}
