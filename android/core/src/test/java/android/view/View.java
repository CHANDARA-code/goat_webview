package android.view;

import android.content.Context;

public class View {
    public static final int VISIBLE = 0;
    public static final int INVISIBLE = 4;
    public static final int GONE = 8;

    public interface OnCreateContextMenuListener {
        void onCreateContextMenu(ContextMenu menu, View v, ContextMenu.ContextMenuInfo menuInfo);
    }
    public interface OnClickListener {
        void onClick(View v);
    }
    public interface OnTouchListener {
        boolean onTouch(View v, Object event);
    }

    private Context context;
    private ViewGroup.LayoutParams layoutParams;
    private int visibility = VISIBLE;
    private int backgroundColor = 0;
    private int overScrollMode = 0;
    private int id = -1;
    ViewParent parent;

    public View(Context context) {
        this.context = context;
    }

    public void setId(int id) {
        this.id = id;
    }

    public int getId() {
        return this.id;
    }

    public Context getContext() {
        return this.context;
    }

    public ViewParent getParent() {
        return this.parent;
    }

    public void setLayoutParams(ViewGroup.LayoutParams params) {
        this.layoutParams = params;
    }

    public ViewGroup.LayoutParams getLayoutParams() {
        return this.layoutParams;
    }

    public void setVisibility(int visibility) {
        this.visibility = visibility;
    }

    public int getVisibility() {
        return this.visibility;
    }

    public void setBackgroundColor(int color) {
        this.backgroundColor = color;
    }

    public void setOverScrollMode(int mode) {
        this.overScrollMode = mode;
    }

    @SuppressWarnings("unchecked")
    public <T extends View> T findViewById(int id) {
        if (this.id == id) {
            return (T) this;
        }
        return null;
    }
}
