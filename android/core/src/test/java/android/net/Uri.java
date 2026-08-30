package android.net;

import java.io.Serializable;

public abstract class Uri implements Comparable<Uri>, Serializable {
    private final String uriString;

    protected Uri() {
        this.uriString = "";
    }

    protected Uri(String uriString) {
        this.uriString = uriString != null ? uriString : "";
    }

    public static Uri parse(String uriString) {
        return new StringUri(uriString);
    }

    public String getScheme() {
        if (uriString == null || uriString.isEmpty()) return null;
        int idx = uriString.indexOf(":");
        return idx != -1 ? uriString.substring(0, idx) : null;
    }

    public String getHost() {
        if (uriString == null || uriString.isEmpty()) return null;
        try {
            return java.net.URI.create(uriString).getHost();
        } catch (Exception e) {
            return null;
        }
    }

    public String getPath() {
        if (uriString == null || uriString.isEmpty()) return null;
        try {
            return java.net.URI.create(uriString).getPath();
        } catch (Exception e) {
            return null;
        }
    }

    public String getQuery() {
        if (uriString == null || uriString.isEmpty()) return null;
        try {
            return java.net.URI.create(uriString).getQuery();
        } catch (Exception e) {
            return null;
        }
    }

    public String getAuthority() {
        return getHost();
    }

    @Override
    public String toString() {
        return uriString;
    }

    @Override
    public int compareTo(Uri other) {
        return uriString.compareTo(other != null ? other.toString() : "");
    }

    private static class StringUri extends Uri {
        StringUri(String s) {
            super(s);
        }
    }
}
