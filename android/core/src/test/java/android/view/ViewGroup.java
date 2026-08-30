package android.view;

import android.content.Context;
import android.util.AttributeSet;
import java.util.ArrayList;
import java.util.List;

public abstract class ViewGroup extends View implements ViewParent {
    private final List<View> children = new ArrayList<>();

    public static class LayoutParams {
        public static final int MATCH_PARENT = -1;
        public static final int WRAP_CONTENT = -2;
        public int width;
        public int height;

        public LayoutParams(int width, int height) {
            this.width = width;
            this.height = height;
        }

        public LayoutParams(Context context, AttributeSet attrs) {
            this.width = MATCH_PARENT;
            this.height = MATCH_PARENT;
        }
    }

    public ViewGroup(Context context) {
        super(context);
    }

    public ViewGroup(Context context, AttributeSet attrs) {
        super(context);
    }

    public ViewGroup(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context);
    }

    public int getChildCount() {
        return children.size();
    }

    public View getChildAt(int index) {
        if (index >= 0 && index < children.size()) {
            return children.get(index);
        }
        return null;
    }

    public void addView(View child) {
        if (child != null) {
            child.parent = this;
            children.add(child);
        }
    }

    public void addView(View child, LayoutParams params) {
        if (child != null) {
            child.setLayoutParams(params);
            child.parent = this;
            children.add(child);
        }
    }

    public void removeAllViews() {
        for (View child : children) {
            child.parent = null;
        }
        children.clear();
    }

    public void removeView(View view) {
        if (view != null) {
            view.parent = null;
            children.remove(view);
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public <T extends View> T findViewById(int id) {
        if (getId() == id) {
            return (T) this;
        }
        for (View child : children) {
            if (child.getId() == id) {
                return (T) child;
            }
            T found = child.findViewById(id);
            if (found != null) {
                return found;
            }
        }
        return null;
    }

    @Override
    public void requestLayout() {}
}
