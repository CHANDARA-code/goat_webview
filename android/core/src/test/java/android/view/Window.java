package android.view;

import android.content.Context;
import android.widget.FrameLayout;

public class Window {
    private final Context context;
    private final FrameLayout decorView;
    private final FrameLayout contentView;

    public Window(Context context) {
        this.context = context;
        this.decorView = new FrameLayout(context);
        this.contentView = new FrameLayout(context);
        this.contentView.setId(android.R.id.content);
        this.decorView.addView(this.contentView);
    }

    public View getDecorView() {
        return decorView;
    }
}
