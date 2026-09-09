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

    /**
     * Parsed from the string, NOT via java.net.URI, which returns null for any authority containing
     * an underscore. This project's tenant domains are {appId}.appassets.androidplatform.net and
     * appIds routinely contain underscores ("tenant_alpha"), so delegating made every such tenant
     * read as host==null and be treated as an external origin. android.net.Uri is lenient here.
     */
    public String getHost() {
        String authority = getAuthority();
        if (authority == null) return null;
        int at = authority.lastIndexOf('@');
        String hostPort = at >= 0 ? authority.substring(at + 1) : authority;
        int colon = hostPort.lastIndexOf(':');
        if (colon >= 0) {
            String portPart = hostPort.substring(colon + 1);
            boolean numeric = !portPart.isEmpty();
            for (int i = 0; i < portPart.length(); i++) {
                if (!Character.isDigit(portPart.charAt(i))) { numeric = false; break; }
            }
            if (numeric) hostPort = hostPort.substring(0, colon);
        }
        return hostPort.isEmpty() ? null : hostPort;
    }

    public String getPath() {
        if (uriString == null || uriString.isEmpty()) return null;
        int start = 0;
        int schemeEnd = uriString.indexOf("://");
        if (schemeEnd >= 0) {
            start = schemeEnd + 3;
            while (start < uriString.length()) {
                char c = uriString.charAt(start);
                if (c == '/' || c == '?' || c == '#') break;
                start++;
            }
        }
        int end = uriString.length();
        for (int i = start; i < uriString.length(); i++) {
            char c = uriString.charAt(i);
            if (c == '?' || c == '#') { end = i; break; }
        }
        return uriString.substring(start, end);
    }

    public String getQuery() {
        if (uriString == null || uriString.isEmpty()) return null;
        int q = uriString.indexOf('?');
        if (q < 0) return null;
        int end = uriString.indexOf('#', q);
        return decode(uriString.substring(q + 1, end < 0 ? uriString.length() : end));
    }

    /** Real Android returns userinfo@host:port, not just the host. */
    public String getAuthority() {
        if (uriString == null || uriString.isEmpty()) return null;
        try {
            String authority = java.net.URI.create(uriString).getAuthority();
            if (authority != null) return authority;
        } catch (Exception ignored) {
        }
        int schemeEnd = uriString.indexOf("://");
        if (schemeEnd < 0) return null;
        String rest = uriString.substring(schemeEnd + 3);
        int end = rest.length();
        for (int i = 0; i < rest.length(); i++) {
            char c = rest.charAt(i);
            if (c == '/' || c == '?' || c == '#') { end = i; break; }
        }
        String authority = rest.substring(0, end);
        return authority.isEmpty() ? null : authority;
    }

    /** -1 when no explicit port is present, matching android.net.Uri. */
    public int getPort() {
        String authority = getAuthority();
        if (authority == null) return -1;
        int at = authority.lastIndexOf('@');
        String hostPort = at >= 0 ? authority.substring(at + 1) : authority;
        int colon = hostPort.lastIndexOf(':');
        if (colon < 0 || colon == hostPort.length() - 1) return -1;
        String portPart = hostPort.substring(colon + 1);
        for (int i = 0; i < portPart.length(); i++) {
            if (!Character.isDigit(portPart.charAt(i))) return -1;
        }
        try {
            return Integer.parseInt(portPart);
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    /** The part after '#', percent-decoded. Null when absent, matching android.net.Uri. */
    public String getFragment() {
        if (uriString == null || uriString.isEmpty()) return null;
        int hash = uriString.indexOf('#');
        if (hash < 0) return null;
        return decode(uriString.substring(hash + 1));
    }

    /**
     * First value for [key] in the query string, percent-decoded, or null. Deliberately hand-rolled
     * rather than delegating to java.net.URI, which rejects strings android.net.Uri accepts.
     */
    public String getQueryParameter(String key) {
        if (key == null) return null;
        String query = getQuery();
        if (query == null || query.isEmpty()) return null;
        for (String pair : query.split("&")) {
            int eq = pair.indexOf('=');
            String name = eq < 0 ? pair : pair.substring(0, eq);
            if (decode(name).equals(key)) {
                return eq < 0 ? "" : decode(pair.substring(eq + 1));
            }
        }
        return null;
    }

    private static String decode(String raw) {
        try {
            return java.net.URLDecoder.decode(raw, "UTF-8");
        } catch (Exception e) {
            return raw;
        }
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
