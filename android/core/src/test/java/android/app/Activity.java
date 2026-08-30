package android.app;

import android.content.Context;
import android.content.ContextWrapper;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;

public class Activity extends ContextWrapper implements View.OnCreateContextMenuListener {
    private Window window;

    public Activity() {
        super(null);
    }

    public Activity(Context base) {
        super(base);
    }

    public Window getWindow() {
        if (window == null) {
            window = new Window(this);
        }
        return window;
    }

    public <T extends View> T findViewById(int id) {
        if (getWindow() != null && getWindow().getDecorView() != null) {
            return getWindow().getDecorView().findViewById(id);
        }
        return null;
    }

    @Override
    public void onCreateContextMenu(android.view.ContextMenu menu, View v, android.view.ContextMenu.ContextMenuInfo menuInfo) {}
}
