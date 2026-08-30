import XCTest
import CoreGraphics
@testable import GoatWebView

final class GoatSameLayerCompositorTests: XCTestCase {

    private var compositor: GoatSameLayerCompositor!
    private var handler: GoatScriptMessageHandler!

    override func setUp() {
        super.setUp()
        compositor = GoatSameLayerCompositor()
        handler = GoatScriptMessageHandler(sameLayerCompositor: compositor)
    }

    override func tearDown() {
        compositor.clearAll()
        super.tearDown()
    }

    func testEmbedNativeComponentRegistersDescriptor() {
        let desc = compositor.embedNativeComponent(
            componentId: "camera_1",
            componentType: "CAMERA_PREVIEW",
            x: 0,
            y: 100,
            width: 375,
            height: 500,
            zIndex: 3,
            opacity: 0.9,
            cornerRadius: 20.0,
            params: ["facing": "front"]
        )

        XCTAssertEqual(desc.componentId, "camera_1")
        XCTAssertEqual(desc.componentType, "CAMERA_PREVIEW")
        XCTAssertEqual(desc.zIndex, 3)
        XCTAssertEqual(desc.opacity, 0.9, accuracy: 0.001)
        XCTAssertEqual(desc.cornerRadius, 20.0, accuracy: 0.001)
        XCTAssertTrue(desc.isVisible)
        XCTAssertEqual(desc.frame, CGRect(x: 0, y: 100, width: 375, height: 500))

        let active = compositor.getActiveComponents()
        XCTAssertEqual(active.count, 1)
        XCTAssertEqual(active.first?.componentId, "camera_1")
    }

    func testUpdateComponentBoundsModifiesGeometryAndClipping() {
        compositor.embedNativeComponent(
            componentId: "video_1",
            componentType: "VIDEO_PLAYER",
            x: 10,
            y: 20,
            width: 300,
            height: 200
        )

        let updated = compositor.updateComponentBounds(
            componentId: "video_1",
            x: 15,
            y: 50,
            width: 350,
            height: 220,
            zIndex: 5,
            opacity: 0.75,
            cornerRadius: 12.0,
            isVisible: true
        )

        XCTAssertNotNil(updated)
        XCTAssertEqual(updated?.x, 15)
        XCTAssertEqual(updated?.y, 50)
        XCTAssertEqual(updated?.width, 350)
        XCTAssertEqual(updated?.height, 220)
        XCTAssertEqual(updated?.zIndex, 5)
        XCTAssertEqual(updated?.opacity ?? 0, 0.75, accuracy: 0.001)
        XCTAssertEqual(updated?.cornerRadius ?? 0, 12.0, accuracy: 0.001)
    }

    func testHitTestCorrectlyIdentifiesTouchPoints() {
        compositor.embedNativeComponent(
            componentId: "map_1",
            componentType: "MAP_VIEW",
            x: 50,
            y: 100,
            width: 200,
            height: 150
        )

        // Inside
        XCTAssertTrue(compositor.hitTest(componentId: "map_1", point: CGPoint(x: 60, y: 120)))
        XCTAssertTrue(compositor.hitTest(componentId: "map_1", point: CGPoint(x: 50, y: 100)))

        // Outside
        XCTAssertFalse(compositor.hitTest(componentId: "map_1", point: CGPoint(x: 40, y: 120)))
        XCTAssertFalse(compositor.hitTest(componentId: "map_1", point: CGPoint(x: 60, y: 90)))
        XCTAssertFalse(compositor.hitTest(componentId: "map_1", point: CGPoint(x: 300, y: 300)))
        XCTAssertFalse(compositor.hitTest(componentId: "unknown", point: CGPoint(x: 60, y: 120)))
    }

    func testRecordFrameCompositedIncrementsCount() {
        compositor.embedNativeComponent(
            componentId: "canvas_1",
            componentType: "CANVAS_2D",
            x: 0,
            y: 0,
            width: 100,
            height: 100
        )

        let count1 = compositor.recordFrameComposited(componentId: "canvas_1")
        let count2 = compositor.recordFrameComposited(componentId: "canvas_1")

        XCTAssertEqual(count1, 1)
        XCTAssertEqual(count2, 2)
    }

    func testRemoveNativeComponentCleansUp() {
        compositor.embedNativeComponent(componentId: "comp_1", componentType: "CUSTOM_SURFACE", x: 0, y: 0, width: 50, height: 50)
        XCTAssertEqual(compositor.getActiveComponents().count, 1)

        let removed = compositor.removeNativeComponent(componentId: "comp_1")
        XCTAssertTrue(removed)
        XCTAssertEqual(compositor.getActiveComponents().count, 0)
    }

    func testZIndexSortingOrder() {
        compositor.embedNativeComponent(componentId: "back", componentType: "VIDEO_PLAYER", x: 0, y: 0, width: 100, height: 100, zIndex: 1)
        compositor.embedNativeComponent(componentId: "front", componentType: "CAMERA_PREVIEW", x: 0, y: 0, width: 100, height: 100, zIndex: 10)
        compositor.embedNativeComponent(componentId: "middle", componentType: "MAP_VIEW", x: 0, y: 0, width: 100, height: 100, zIndex: 5)

        let active = compositor.getActiveComponents()
        XCTAssertEqual(active.count, 3)
        XCTAssertEqual(active[0].componentId, "back")
        XCTAssertEqual(active[1].componentId, "middle")
        XCTAssertEqual(active[2].componentId, "front")
    }

    func testScriptMessageHandlerEmbedAndUpdateFlow() async throws {
        let embedPayload: [String: Any] = [
            "componentId": "live_camera",
            "componentType": "CAMERA_PREVIEW",
            "x": 0,
            "y": 100,
            "width": 375,
            "height": 400,
            "zIndex": 2,
            "opacity": 0.95,
            "cornerRadius": 16.0
        ]

        let embedResult = try await handler.dispatchDirect(action: "EMBED_NATIVE_VIEW", payload: embedPayload)
        XCTAssertEqual(embedResult["embedded"] as? Bool, true)
        XCTAssertEqual(embedResult["componentId"] as? String, "live_camera")

        let updatePayload: [String: Any] = [
            "componentId": "live_camera",
            "x": 0,
            "y": 80,
            "width": 375,
            "height": 400,
            "zIndex": 4
        ]
        let updateResult = try await handler.dispatchDirect(action: "UPDATE_NATIVE_VIEW_BOUNDS", payload: updatePayload)
        XCTAssertEqual(updateResult["updated"] as? Bool, true)

        let listResult = try await handler.dispatchDirect(action: "GET_ACTIVE_NATIVE_VIEWS", payload: [:])
        XCTAssertEqual(listResult["totalActive"] as? Int, 1)

        let removeResult = try await handler.dispatchDirect(action: "REMOVE_NATIVE_VIEW", payload: ["componentId": "live_camera"])
        XCTAssertEqual(removeResult["removed"] as? Bool, true)

        let emptyList = try await handler.dispatchDirect(action: "GET_ACTIVE_NATIVE_VIEWS", payload: [:])
        XCTAssertEqual(emptyList["totalActive"] as? Int, 0)
    }
}
