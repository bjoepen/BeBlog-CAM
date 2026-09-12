#include <BRepAlgoAPI_Cut.hxx>
#include <BRepPrimAPI_MakeBox.hxx>
#include <BRepPrimAPI_MakeCylinder.hxx>
#include <BRepPrimAPI_MakeSphere.hxx>
#include <STEPControl_StepModelType.hxx>
#include <STEPControl_Writer.hxx>
#include <gp_Ax2.hxx>
#include <gp_Dir.hxx>
#include <gp_Pnt.hxx>

#include <iostream>

int main(int argc, char** argv) {
    if (argc != 2) {
        std::cerr << "usage: 008a3-master-step <output.step>\n";
        return 2;
    }

    // Deterministic A3 master part:
    // - 60 x 40 x 10 mm base plate
    // - one open rectangular pocket, 3 mm deep
    // - two through holes, Ø6 mm
    // - one shallow spherical recess as a genuinely curved 3D face
    //
    // The part intentionally never exceeds Z=10, so a 10 mm stock keeps the
    // production WCS at the real model top. This matters for STEP pocket,
    // contour, Z-level and finishing acceptance.
    TopoDS_Shape shape = BRepPrimAPI_MakeBox(60.0, 40.0, 10.0).Shape();

    const TopoDS_Shape pocket = BRepPrimAPI_MakeBox(gp_Pnt(10.0, 10.0, 7.0), 22.0, 16.0, 3.0).Shape();
    shape = BRepAlgoAPI_Cut(shape, pocket).Shape();

    const TopoDS_Shape holeA = BRepPrimAPI_MakeCylinder(
        gp_Ax2(gp_Pnt(45.0, 12.0, 0.0), gp_Dir(0.0, 0.0, 1.0)), 3.0, 10.0).Shape();
    const TopoDS_Shape holeB = BRepPrimAPI_MakeCylinder(
        gp_Ax2(gp_Pnt(48.0, 28.0, 0.0), gp_Dir(0.0, 0.0, 1.0)), 3.0, 10.0).Shape();
    shape = BRepAlgoAPI_Cut(shape, holeA).Shape();
    shape = BRepAlgoAPI_Cut(shape, holeB).Shape();

    // Sphere center above the stock top: only the lower cap intersects the
    // plate and creates a shallow bowl instead of changing the part height.
    const TopoDS_Shape bowl = BRepPrimAPI_MakeSphere(gp_Pnt(40.0, 28.0, 13.0), 5.0).Shape();
    shape = BRepAlgoAPI_Cut(shape, bowl).Shape();

    if (shape.IsNull()) {
        std::cerr << "A3 master shape is null\n";
        return 3;
    }

    STEPControl_Writer writer;
    if (writer.Transfer(shape, STEPControl_AsIs) != IFSelect_RetDone) {
        std::cerr << "STEP transfer failed\n";
        return 4;
    }
    if (writer.Write(argv[1]) != IFSelect_RetDone) {
        std::cerr << "STEP write failed\n";
        return 5;
    }

    std::cout << argv[1] << "\n";
    return 0;
}
