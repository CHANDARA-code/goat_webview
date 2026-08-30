package android.os;

public class Process {
    public static final int myPid() { return 12345; }
    public static final int myUid() { return 1000; }
    public static final int myTid() { return 1; }
    public static final void killProcess(int pid) {}
}
