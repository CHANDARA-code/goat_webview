package android.webkit;

public class WebSettings {
    public static final int LOAD_DEFAULT = -1;
    public static final int LOAD_NORMAL = 0;
    public static final int LOAD_CACHE_ELSE_NETWORK = 1;
    public static final int LOAD_NO_CACHE = 2;
    public static final int LOAD_CACHE_ONLY = 3;

    public static final int MIXED_CONTENT_ALWAYS_ALLOW = 0;
    public static final int MIXED_CONTENT_NEVER_ALLOW = 1;
    public static final int MIXED_CONTENT_COMPATIBILITY_MODE = 2;

    public void setJavaScriptEnabled(boolean flag) {}
    public void setDomStorageEnabled(boolean flag) {}
    public void setDatabaseEnabled(boolean flag) {}
    public void setAllowFileAccess(boolean flag) {}
    public void setAllowContentAccess(boolean flag) {}
    public void setAllowFileAccessFromFileURLs(boolean flag) {}
    public void setAllowUniversalAccessFromFileURLs(boolean flag) {}
    public void setCacheMode(int mode) {}
    public void setMixedContentMode(int mode) {}
    public void setMediaPlaybackRequiresUserGesture(boolean require) {}
    public void setSupportZoom(boolean support) {}
    public void setBuiltInZoomControls(boolean enabled) {}
    public void setDisplayZoomControls(boolean enabled) {}
    public void setUseWideViewPort(boolean use) {}
    public void setLoadWithOverviewMode(boolean overview) {}
    public void setOffscreenPreRaster(boolean enabled) {}
}
