package android.webkit

class FakeSslErrorHandler : SslErrorHandler() {
    var proceedCalled = false
    var cancelCalled = false

    override fun proceed() {
        proceedCalled = true
    }

    override fun cancel() {
        cancelCalled = true
    }
}

