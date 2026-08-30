package android.webkit;

import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;

public class CookieManager {
    private static CookieManager instance;
    private final Map<String, Map<String, String>> cookieStore = new ConcurrentHashMap<>();

    public static synchronized CookieManager getInstance() {
        if (instance == null) {
            instance = new CookieManager();
        }
        return instance;
    }

    public synchronized void setCookie(String url, String value) {
        setCookie(url, value, null);
    }

    public synchronized void setCookie(String url, String value, ValueCallback<Boolean> callback) {
        if (url != null && value != null) {
            String domain = extractHost(url);
            Map<String, String> domainCookies = cookieStore.computeIfAbsent(domain, k -> new ConcurrentHashMap<>());
            String[] parts = value.split(";");
            if (parts.length > 0) {
                String[] mainPair = parts[0].split("=", 2);
                String name = mainPair[0].trim();
                String val = mainPair.length > 1 ? mainPair[1].trim() : "";
                
                // Check if Max-Age <= 0 or Expires in past
                boolean isDeleted = false;
                for (int i = 1; i < parts.length; i++) {
                    String attr = parts[i].trim().toLowerCase();
                    if (attr.startsWith("max-age=")) {
                        String ageStr = attr.substring(8).trim();
                        try {
                            if (Long.parseLong(ageStr) <= 0) {
                                isDeleted = true;
                            }
                        } catch (Exception ignored) {}
                    }
                }
                
                if (isDeleted || val.isEmpty() && value.contains("Max-Age=-1")) {
                    domainCookies.remove(name);
                } else {
                    domainCookies.put(name, val);
                }
            }
        }
        if (callback != null) {
            callback.onReceiveValue(true);
        }
    }

    public synchronized String getCookie(String url) {
        if (url == null) return null;
        String domain = extractHost(url);
        Map<String, String> domainCookies = cookieStore.get(domain);
        if (domainCookies == null || domainCookies.isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> entry : domainCookies.entrySet()) {
            if (sb.length() > 0) {
                sb.append("; ");
            }
            sb.append(entry.getKey()).append("=").append(entry.getValue());
        }
        return sb.length() > 0 ? sb.toString() : null;
    }

    public synchronized void removeAllCookies(ValueCallback<Boolean> callback) {
        cookieStore.clear();
        if (callback != null) {
            callback.onReceiveValue(true);
        }
    }

    public synchronized void removeSessionCookies(ValueCallback<Boolean> callback) {
        if (callback != null) {
            callback.onReceiveValue(true);
        }
    }

    public synchronized void flush() {}

    public synchronized boolean hasCookies() {
        return !cookieStore.isEmpty();
    }

    public void setAcceptCookie(boolean accept) {}
    public boolean acceptCookie() { return true; }
    public void setAcceptThirdPartyCookies(WebView webview, boolean accept) {}
    public boolean acceptThirdPartyCookies(WebView webview) { return true; }

    private String extractHost(String url) {
        try {
            java.net.URI uri = new java.net.URI(url);
            String host = uri.getHost();
            return host != null ? host : url;
        } catch (Exception e) {
            return url;
        }
    }
}
