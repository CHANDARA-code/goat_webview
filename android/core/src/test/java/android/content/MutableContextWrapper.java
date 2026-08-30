package android.content;

public class MutableContextWrapper extends ContextWrapper {
    private Context baseContext;

    public MutableContextWrapper(Context base) {
        super(base);
        this.baseContext = base;
    }

    public void setBaseContext(Context base) {
        this.baseContext = base;
    }

    @Override
    public Context getBaseContext() {
        return this.baseContext;
    }

    @Override
    public Context getApplicationContext() {
        return this.baseContext != null ? this.baseContext.getApplicationContext() : this;
    }
}
