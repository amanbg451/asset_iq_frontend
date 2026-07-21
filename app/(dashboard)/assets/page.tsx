"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { z } from "zod";
import api, { formatValidationError } from "@/app/lib/api";
import * as XLSX from "xlsx";

interface Category {
  id: string;
  name: string;
  is_active: boolean;
}

interface AssetType {
  id: string;
  name: string;
  category_id: string;
  is_active: boolean;
}

interface Department {
  id: string;
  name: string;
  is_active: boolean;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

interface Location {
  id: string;
  name: string;
  location_type: string;
  full_path: string;
}

interface Asset {
  id: string;
  client_id: string;
  category_id: string;
  type_id: string;
  department_id: string | null;
  assigned_to_user_id: string | null;
  location_id: string | null;
  name: string;
  description: string | null;
  serial_number: string | null;
  model: string | null;
  manufacturer: string | null;
  purchase_date: string | null;
  purchase_value: number | null;
  status: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  created_image_url: string | null;
  latest_image_url: string | null;
  qr_code_url: string | null;
}

interface BulkAssetRow {
  rowNumber: number;
  category_id: string;
  type_id: string;
  name: string;
  department_id: string;
  location_id: string;
  assigned_to_user_id: string;
  description: string;
  serial_number: string;
  model: string;
  manufacturer: string;
  purchase_date: string;
  purchase_value: string;
  errors: string[];
}

const BULK_TEMPLATE_HEADERS = [
  "category_id",
  "type_id",
  "name",
  "department_id",
  "location_id",
  "assigned_to_user_id",
  "description",
  "serial_number",
  "model",
  "manufacturer",
  "purchase_date",
  "purchase_value",
];

// Updated Zod schema - removed image_url
const assetSchema = z.object({
  category_id: z.string().min(1, "Please select a category"),
  type_id: z.string().min(1, "Please select a type"),
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(200, "Name must be at most 200 characters"),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .default(""),
  serial_number: z
    .string()
    .max(100, "Serial number must be at most 100 characters")
    .optional()
    .default(""),
  model: z
    .string()
    .max(100, "Model must be at most 100 characters")
    .optional()
    .default(""),
  manufacturer: z
    .string()
    .max(100, "Manufacturer must be at most 100 characters")
    .optional()
    .default(""),
  department_id: z.string().optional().default(""),
  assigned_to_user_id: z.string().optional().default(""),
  location_id: z.string().optional().default(""),
  purchase_date: z.string().optional().default(""),
  purchase_value: z
    .number()
    .min(0, "Value must be at least 0")
    .optional()
    .default(0),
  status: z.enum([
    "AVAILABLE",
    "ASSIGNED",
    "MAINTENANCE",
    "TRANSIT",
    "DECOMMISSIONED",
  ]),
});

const assignSchema = z.object({
  user_id: z.string().min(1, "Please select a user"),
});

export default function AssetsPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<AssetType[]>([]);
  const [filteredTypes, setFilteredTypes] = useState<AssetType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Bulk upload state
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkRows, setBulkRows] = useState<BulkAssetRow[]>([]);
  const [bulkParsing, setBulkParsing] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkDragging, setBulkDragging] = useState(false);
  const [bulkClientId, setBulkClientId] = useState("");

  // New image file states - simple file selection
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [editImagePreview, setEditImagePreview] = useState<string>("");

  const [formData, setFormData] = useState({
    category_id: "",
    type_id: "",
    department_id: "",
    assigned_to_user_id: "",
    location_id: "",
    name: "",
    description: "",
    serial_number: "",
    model: "",
    manufacturer: "",
    purchase_date: "",
    purchase_value: "",
    status: "AVAILABLE",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [editFormData, setEditFormData] = useState({
    category_id: "",
    type_id: "",
    department_id: "",
    assigned_to_user_id: "",
    location_id: "",
    name: "",
    description: "",
    serial_number: "",
    model: "",
    manufacturer: "",
    purchase_date: "",
    purchase_value: "",
    status: "AVAILABLE",
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const [assignFormData, setAssignFormData] = useState({
    user_id: "",
  });
  const [assignErrors, setAssignErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get("/asset-categories");
      const activeCategories = (response.data || []).filter(
        (c: Category) => c.is_active !== false,
      );
      setCategories(activeCategories);
    } catch (error: any) {
      console.error("Error fetching categories:", error);
    }
  }, []);

  const fetchTypes = useCallback(async () => {
    try {
      const response = await api.get("/asset-types");
      const activeTypes = (response.data || []).filter(
        (t: AssetType) => t.is_active !== false,
      );
      setTypes(activeTypes);
    } catch (error: any) {
      console.error("Error fetching types:", error);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await api.get("/departments");
      const activeDepts = (response.data || []).filter(
        (d: Department) => d.is_active !== false,
      );
      setDepartments(activeDepts);
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.warn("Departments fetch skipped - insufficient permissions");
        setDepartments([]);
        return;
      }
      console.error("Error fetching departments:", error);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get("/users");
      const activeUsers = (response.data || []).filter(
        (u: User) => u.is_active !== false,
      );
      setUsers(activeUsers);
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.warn("Users fetch skipped - insufficient permissions");
        setUsers([]);
        return;
      }
      console.error("Error fetching users:", error);
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const response = await api.get("/location/cards");
      setLocations(response.data || []);
    } catch (error: any) {
      console.error("Error fetching locations:", error);
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/assets");
      setAssets(response.data || []);
    } catch (error: any) {
      console.error("Error fetching assets:", error);
      toast.error(formatValidationError(error) || "Failed to fetch assets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    Promise.all([
      fetchCategories(),
      fetchTypes(),
      fetchDepartments(),
      fetchUsers(),
      fetchAssets(),
      fetchLocations(),
    ]);
  }, [
    mounted,
    router,
    fetchCategories,
    fetchTypes,
    fetchDepartments,
    fetchUsers,
    fetchAssets,
    fetchLocations,
  ]);

  // Filter types based on selected category in both create and edit forms
  useEffect(() => {
    if (formData.category_id) {
      const filtered = types.filter(
        (t) => t.category_id === formData.category_id && t.is_active !== false,
      );
      setFilteredTypes(filtered);
      if (
        formData.type_id &&
        !filtered.some((t) => t.id === formData.type_id)
      ) {
        setFormData((prev) => ({ ...prev, type_id: "" }));
      }
    } else {
      setFilteredTypes([]);
    }
  }, [formData.category_id, types]);

  useEffect(() => {
    if (editFormData.category_id) {
      const filtered = types.filter(
        (t) =>
          t.category_id === editFormData.category_id && t.is_active !== false,
      );
      setFilteredTypes(filtered);
      if (
        editFormData.type_id &&
        !filtered.some((t) => t.id === editFormData.type_id)
      ) {
        setEditFormData((prev) => ({ ...prev, type_id: "" }));
      }
    }
  }, [editFormData.category_id, types]);

  // NEW: Simple image file selection for create
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      e.target.value = "";
      return;
    }

    setImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  };

  // NEW: Simple image file selection for edit
  const handleEditImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      e.target.value = "";
      return;
    }

    setEditImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setEditImagePreview(previewUrl);
  };

  // NEW: Remove image for create
  const removeImage = () => {
    setImageFile(null);
    setImagePreview("");
  };

  // NEW: Remove image for edit
  const removeEditImage = () => {
    setEditImageFile(null);
    setEditImagePreview("");
  };

  const getLocationName = (locationId: string | null) => {
    if (!locationId) return "—";
    const loc = locations.find((l) => l.id === locationId);
    return loc ? loc.full_path : "Unknown";
  };

  // ===== BULK UPLOAD HELPERS =====

  // Best-effort, non-verifying decode of the JWT payload just to read
  // convenience claims like client_id. Never used for auth decisions.
  const decodeJwtClaim = (claimNames: string[]): string => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) return "";
      const parts = token.split(".");
      if (parts.length < 2) return "";
      const payloadJson = atob(
        parts[1].replace(/-/g, "+").replace(/_/g, "/"),
      );
      const payload = JSON.parse(payloadJson);
      for (const name of claimNames) {
        if (payload[name]) return String(payload[name]);
      }
      return "";
    } catch {
      return "";
    }
  };

  const openBulkModal = () => {
    // Pre-fill client_id if this token carries it (helps ADMIN-role users;
    // harmless for CLIENT_ADMIN since the backend ignores it in that case).
    const detected = decodeJwtClaim(["client_id", "clientId", "tenant_id"]);
    setBulkClientId(detected);
    setShowBulkModal(true);
  };

  const validateBulkRow = (
    row: Omit<BulkAssetRow, "errors" | "rowNumber">,
  ): string[] => {
    const errors: string[] = [];

    if (!row.category_id) {
      errors.push("category_id is required");
    } else if (!categories.some((c) => c.id === row.category_id)) {
      errors.push("category_id not found");
    }

    if (!row.type_id) {
      errors.push("type_id is required");
    } else {
      const type = types.find((t) => t.id === row.type_id);
      if (!type) {
        errors.push("type_id not found");
      } else if (row.category_id && type.category_id !== row.category_id) {
        errors.push("type_id does not belong to category_id");
      }
    }

    if (!row.name || row.name.trim().length < 2) {
      errors.push("name is required (min 2 chars)");
    } else if (row.name.trim().length > 200) {
      errors.push("name too long (max 200 chars)");
    }

    if (row.department_id && !departments.some((d) => d.id === row.department_id)) {
      errors.push("department_id not found");
    }

    if (row.location_id && !locations.some((l) => l.id === row.location_id)) {
      errors.push("location_id not found");
    }

    if (
      row.assigned_to_user_id &&
      !users.some((u) => u.id === row.assigned_to_user_id)
    ) {
      errors.push("assigned_to_user_id not found");
    }

    if (row.purchase_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.purchase_date)) {
      errors.push("purchase_date must be YYYY-MM-DD");
    }

    if (row.purchase_value) {
      const num = Number(row.purchase_value);
      if (Number.isNaN(num) || num < 0) {
        errors.push("purchase_value must be a non-negative number");
      }
    }

    return errors;
  };

  const parseBulkFile = (file: File) => {
    setBulkParsing(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(sheet, {
          defval: "",
          raw: false,
        });

        if (jsonRows.length === 0) {
          toast.error("The file has no rows to import");
          setBulkRows([]);
          setBulkParsing(false);
          return;
        }

        const parsedRows: BulkAssetRow[] = jsonRows.map((raw, idx) => {
          const base = {
            category_id: String(raw.category_id || "").trim(),
            type_id: String(raw.type_id || "").trim(),
            name: String(raw.name || "").trim(),
            department_id: String(raw.department_id || "").trim(),
            location_id: String(raw.location_id || "").trim(),
            assigned_to_user_id: String(raw.assigned_to_user_id || "").trim(),
            description: String(raw.description || "").trim(),
            serial_number: String(raw.serial_number || "").trim(),
            model: String(raw.model || "").trim(),
            manufacturer: String(raw.manufacturer || "").trim(),
            purchase_date: String(raw.purchase_date || "").trim(),
            purchase_value: String(raw.purchase_value || "").trim(),
          };
          return {
            rowNumber: idx + 2, // account for header row
            ...base,
            errors: validateBulkRow(base),
          };
        });

        setBulkRows(parsedRows);
      } catch (error) {
        console.error("Error parsing bulk file:", error);
        toast.error(
          "Could not read that file. Please upload a valid .xlsx or .xls file",
        );
        setBulkRows([]);
      } finally {
        setBulkParsing(false);
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read the file");
      setBulkParsing(false);
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExt = /\.(xlsx|xls)$/i.test(file.name);
    if (!validExt) {
      toast.error("Please upload a .xlsx or .xls file");
      e.target.value = "";
      return;
    }

    setBulkFile(file);
    parseBulkFile(file);
  };

  const removeBulkFile = () => {
    setBulkFile(null);
    setBulkRows([]);
  };

  const closeBulkModal = () => {
    setShowBulkModal(false);
    setBulkFile(null);
    setBulkRows([]);
    setBulkParsing(false);
    setBulkSubmitting(false);
    setBulkClientId("");
  };

  const downloadBulkTemplate = () => {
    const sampleRow = {
      category_id: "CATEGORY_UUID",
      type_id: "TYPE_UUID",
      name: "Dell Laptop 1",
      department_id: "",
      location_id: "",
      assigned_to_user_id: "",
      description: "",
      serial_number: "DELL-001",
      model: "Latitude 5420",
      manufacturer: "Dell",
      purchase_date: "2026-07-20",
      purchase_value: "65000",
    };
    const worksheet = XLSX.utils.json_to_sheet([sampleRow], {
      header: BULK_TEMPLATE_HEADERS,
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Assets");
    XLSX.writeFile(workbook, "asset_bulk_upload_template.xlsx");
  };

  const bulkValidCount = bulkRows.filter((r) => r.errors.length === 0).length;
  const bulkErrorCount = bulkRows.length - bulkValidCount;
  const bulkHasBlockingErrors = bulkRows.length === 0 || bulkErrorCount > 0;

  const handleBulkCreate = async () => {
    if (bulkRows.length === 0 || bulkErrorCount > 0) return;

    setBulkSubmitting(true);
    try {
      const assets = bulkRows.map((row) => {
        const asset: any = {
          category_id: row.category_id,
          type_id: row.type_id,
          name: row.name.trim(),
          custom_fields: [],
        };
        if (row.department_id) asset.department_id = row.department_id;
        if (row.location_id) asset.location_id = row.location_id;
        if (row.assigned_to_user_id)
          asset.assigned_to_user_id = row.assigned_to_user_id;
        if (row.description) asset.description = row.description;
        if (row.serial_number) asset.serial_number = row.serial_number;
        if (row.model) asset.model = row.model;
        if (row.manufacturer) asset.manufacturer = row.manufacturer;
        if (row.purchase_date) asset.purchase_date = row.purchase_date;
        if (row.purchase_value)
          asset.purchase_value = Number(row.purchase_value);
        return asset;
      });

      const payload: any = { assets };
      if (bulkClientId && bulkClientId.trim() !== "") {
        payload.client_id = bulkClientId.trim();
      }

      await api.post("/assets/bulk", payload);
      toast.success(
        `${assets.length} asset${assets.length === 1 ? "" : "s"} created successfully`,
      );
      closeBulkModal();
      fetchAssets();
    } catch (error: any) {
      console.error("Error bulk creating assets:", error);
      toast.error(
        formatValidationError(error) || "Failed to bulk create assets",
      );
    } finally {
      setBulkSubmitting(false);
    }
  };

  // UPDATED: Create asset with image in single request
  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();

    // Convert purchase_value to number
    const dataToValidate = {
      ...formData,
      purchase_value: formData.purchase_value
        ? parseFloat(formData.purchase_value)
        : 0,
    };

    const result = assetSchema.safeParse(dataToValidate);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const path = err.path.join(".");
        errors[path] = err.message;
      });
      setFormErrors(errors);
      toast.error(result.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    try {
      const formDataToSend = new FormData();

      // Build asset data object
      const assetData: any = {
        category_id: result.data.category_id,
        type_id: result.data.type_id,
        name: result.data.name.trim(),
        status: result.data.status,
      };

      if (result.data.department_id && result.data.department_id !== "")
        assetData.department_id = result.data.department_id;
      if (
        result.data.assigned_to_user_id &&
        result.data.assigned_to_user_id !== ""
      )
        assetData.assigned_to_user_id = result.data.assigned_to_user_id;
      if (result.data.location_id && result.data.location_id !== "")
        assetData.location_id = result.data.location_id;
      if (result.data.description && result.data.description !== "")
        assetData.description = result.data.description;
      if (result.data.serial_number && result.data.serial_number !== "")
        assetData.serial_number = result.data.serial_number;
      if (result.data.model && result.data.model !== "")
        assetData.model = result.data.model;
      if (result.data.manufacturer && result.data.manufacturer !== "")
        assetData.manufacturer = result.data.manufacturer;
      if (result.data.purchase_date && result.data.purchase_date !== "")
        assetData.purchase_date = result.data.purchase_date;
      if (result.data.purchase_value && result.data.purchase_value > 0)
        assetData.purchase_value = result.data.purchase_value;

      // Append asset_data as JSON string
      formDataToSend.append("asset_data", JSON.stringify(assetData));

      // Append image file if selected
      if (imageFile) {
        formDataToSend.append("image_file", imageFile);
      }

      await api.post("/assets", formDataToSend, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Asset created successfully");
      setShowModal(false);
      setFormData({
        category_id: "",
        type_id: "",
        department_id: "",
        assigned_to_user_id: "",
        location_id: "",
        name: "",
        description: "",
        serial_number: "",
        model: "",
        manufacturer: "",
        purchase_date: "",
        purchase_value: "",
        status: "AVAILABLE",
      });
      setFormErrors({});
      setImageFile(null);
      setImagePreview("");
      fetchAssets();
    } catch (error: any) {
      console.error("Error creating asset:", error);
      toast.error(formatValidationError(error) || "Failed to create asset");
    } finally {
      setSubmitting(false);
    }
  };

  // UPDATED: Update asset with image in single request
  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAsset) return;

    const dataToValidate = {
      ...editFormData,
      purchase_value: editFormData.purchase_value
        ? parseFloat(editFormData.purchase_value)
        : 0,
    };

    const result = assetSchema.safeParse(dataToValidate);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const path = err.path.join(".");
        errors[path] = err.message;
      });
      setEditErrors(errors);
      toast.error(result.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    try {
      const formDataToSend = new FormData();

      const assetData: any = {
        category_id: result.data.category_id,
        type_id: result.data.type_id,
        name: result.data.name.trim(),
        status: result.data.status,
      };

      if (result.data.department_id && result.data.department_id !== "")
        assetData.department_id = result.data.department_id;
      if (
        result.data.assigned_to_user_id &&
        result.data.assigned_to_user_id !== ""
      )
        assetData.assigned_to_user_id = result.data.assigned_to_user_id;
      if (result.data.location_id && result.data.location_id !== "")
        assetData.location_id = result.data.location_id;
      if (result.data.description && result.data.description !== "")
        assetData.description = result.data.description;
      if (result.data.serial_number && result.data.serial_number !== "")
        assetData.serial_number = result.data.serial_number;
      if (result.data.model && result.data.model !== "")
        assetData.model = result.data.model;
      if (result.data.manufacturer && result.data.manufacturer !== "")
        assetData.manufacturer = result.data.manufacturer;
      if (result.data.purchase_date && result.data.purchase_date !== "")
        assetData.purchase_date = result.data.purchase_date;
      if (result.data.purchase_value && result.data.purchase_value > 0)
        assetData.purchase_value = result.data.purchase_value;

      formDataToSend.append("asset_data", JSON.stringify(assetData));

      // Append image file if selected (optional for update)
      if (editImageFile) {
        formDataToSend.append("image_file", editImageFile);
      }

      await api.patch(`/assets/${selectedAsset.id}`, formDataToSend, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Asset updated successfully");
      setShowEditModal(false);
      setSelectedAsset(null);
      setEditErrors({});
      setEditImageFile(null);
      setEditImagePreview("");
      fetchAssets();
    } catch (error: any) {
      console.error("Error updating asset:", error);
      toast.error(formatValidationError(error) || "Failed to update asset");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAsset = async () => {
    if (!selectedAsset) return;

    setSubmitting(true);
    try {
      await api.delete(`/assets/${selectedAsset.id}`);
      toast.success("Asset deactivated successfully");
      setShowDeleteConfirm(false);
      setSelectedAsset(null);
      fetchAssets();
    } catch (error: any) {
      console.error("Error deleting asset:", error);
      toast.error(formatValidationError(error) || "Failed to delete asset");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignAsset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAsset) return;

    const result = assignSchema.safeParse(assignFormData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const path = err.path.join(".");
        errors[path] = err.message;
      });
      setAssignErrors(errors);
      toast.error(result.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/assets/${selectedAsset.id}/assign`, {
        user_id: result.data.user_id,
      });
      toast.success("Asset assigned successfully");
      setShowAssignModal(false);
      setAssignFormData({ user_id: "" });
      setAssignErrors({});
      setSelectedAsset(null);
      fetchAssets();
    } catch (error: any) {
      console.error("Error assigning asset:", error);
      toast.error(formatValidationError(error) || "Failed to assign asset");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassignAsset = async (asset: Asset) => {
    setSubmitting(true);
    try {
      await api.post(`/assets/${asset.id}/unassign`);
      toast.success("Asset unassigned successfully");
      fetchAssets();
    } catch (error: any) {
      console.error("Error unassigning asset:", error);
      toast.error(formatValidationError(error) || "Failed to unassign asset");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (asset: Asset) => {
    setSelectedAsset(asset);
    setEditFormData({
      category_id: asset.category_id,
      type_id: asset.type_id,
      department_id: asset.department_id || "",
      assigned_to_user_id: asset.assigned_to_user_id || "",
      location_id: asset.location_id || "",
      name: asset.name,
      description: asset.description || "",
      serial_number: asset.serial_number || "",
      model: asset.model || "",
      manufacturer: asset.manufacturer || "",
      purchase_date: asset.purchase_date || "",
      purchase_value: asset.purchase_value?.toString() || "",
      status: asset.status || "AVAILABLE",
    });
    setEditErrors({});
    setEditImageFile(null);
    setEditImagePreview("");
    setShowEditModal(true);
  };

  const openAssignModal = (asset: Asset) => {
    setSelectedAsset(asset);
    setAssignFormData({ user_id: "" });
    setAssignErrors({});
    setShowAssignModal(true);
  };

  const openDeleteConfirm = (asset: Asset) => {
    setSelectedAsset(asset);
    setShowDeleteConfirm(true);
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category ? category.name : "Unknown";
  };

  const getTypeName = (typeId: string) => {
    const type = types.find((t) => t.id === typeId);
    return type ? type.name : "Unknown";
  };

  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return "—";
    const dept = departments.find((d) => d.id === departmentId);
    return dept ? dept.name : "Unknown";
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return "—";
    const user = users.find((u) => u.id === userId);
    return user ? user.full_name : "Unknown";
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      AVAILABLE: "bg-green-100 text-green-700",
      ASSIGNED: "bg-blue-100 text-blue-700",
      MAINTENANCE: "bg-yellow-100 text-yellow-700",
      TRANSIT: "bg-purple-100 text-purple-700",
      DECOMMISSIONED: "bg-red-100 text-red-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const filteredAssets = assets.filter(
    (asset) =>
      (showDeactivated
        ? asset.is_active === false
        : asset.is_active !== false) &&
      (statusFilter === "" || asset.status === statusFilter) &&
      (asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.serial_number &&
          asset.serial_number
            .toLowerCase()
            .includes(searchTerm.toLowerCase())) ||
        getCategoryName(asset.category_id)
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        getTypeName(asset.type_id)
          .toLowerCase()
          .includes(searchTerm.toLowerCase())),
  );

  const activeCount = assets.filter((a) => a.is_active !== false).length;
  const deactivatedCount = assets.filter((a) => a.is_active === false).length;
  const availableCount = assets.filter(
    (a) => a.is_active !== false && a.status === "AVAILABLE",
  ).length;
  const assignedCount = assets.filter(
    (a) => a.is_active !== false && a.status === "ASSIGNED",
  ).length;

  if (!mounted) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-12 h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.2, 0.9, 0.4, 1.1) forwards; }
        .fade-in-scale { animation: fadeInScale 0.3s ease forwards; }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeInUp 0.25s ease;
          padding: 16px;
        }
        .modal-content {
          background: linear-gradient(145deg, #ffffff 0%, #fefefe 100%);
          border-radius: 32px;
          width: 95%;
          max-width: 820px;
          max-height: 90vh;
          overflow-y: auto;
          animation: fadeInScale 0.35s cubic-bezier(0.2, 0.9, 0.4, 1.2);
          box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(220, 38, 38, 0.08);
          padding: 24px 20px 28px;
        }

        @media (min-width: 640px) {
          .modal-content {
            padding: 28px 32px 32px;
          }
        }

        .modal-content::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .modal-content::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 20px;
          margin: 12px 0;
          box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.02);
        }
        .modal-content::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #dc2626, #ef4444);
          border-radius: 20px;
          border: 2px solid transparent;
          background-clip: padding-box;
          transition: all 0.2s ease;
        }
        .modal-content {
          scrollbar-width: thin;
          scrollbar-color: #dc2626 #f1f5f9;
          scroll-behavior: smooth;
        }

        .delete-modal { max-width: 440px; }
        .bulk-modal { max-width: 980px; }

        .stat-card {
          background: white;
          border-radius: 16px;
          border: 1px solid #f1f5f9;
          transition: all 0.3s ease;
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px -8px rgba(0,0,0,0.1);
        }

        .input-fancy {
          transition: all 0.2s ease;
          background: #fafbfc;
        }
        .input-fancy:focus {
          background: white;
          transform: scale(1.01);
        }
        .input-fancy::placeholder {
          color: #9ca3af;
          font-weight: 400;
          opacity: 0.9;
        }

        .table-wrapper {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scroll-behavior: smooth;
        }
        
        .table-wrapper::-webkit-scrollbar {
          height: 8px;
        }
        .table-wrapper::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 20px;
        }
        .table-wrapper::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, #dc2626, #ef4444);
          border-radius: 20px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .table-wrapper::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(90deg, #b91c1c, #dc2626);
        }

        .asset-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          font-weight: 400;
          min-width: 1000px;
        }
        @media (min-width: 1280px) {
          .asset-table {
            min-width: auto;
          }
        }
        .asset-table thead th {
          text-align: left;
          padding: 10px 12px;
          font-weight: 600;
          font-size: 11px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid #f1f5f9;
          background: #fafbfc;
          white-space: nowrap;
          vertical-align: middle;
        }
        @media (min-width: 640px) {
          .asset-table thead th {
            padding: 12px 16px;
            font-size: 12px;
          }
        }
        @media (min-width: 1024px) {
          .asset-table thead th {
            font-size: 13px;
          }
        }
        .asset-table tbody td {
          padding: 10px 12px;
          border-bottom: 1px solid #f1f5f9;
          color: #1f2937;
          font-size: 13px;
          font-weight: 400;
          vertical-align: middle;
        }
        @media (min-width: 640px) {
          .asset-table tbody td {
            padding: 12px 16px;
            font-size: 14px;
          }
        }
        .asset-table tbody tr {
          cursor: default;
          transition: background 0.15s ease;
        }
        .asset-table tbody tr:hover {
          background: #fef2f2;
        }

        .asset-table th:first-child,
        .asset-table td:first-child {
          width: 60px;
          text-align: center;
        }
        .asset-table th:nth-child(2),
        .asset-table td:nth-child(2) {
          min-width: 120px;
        }
        .asset-table th:nth-child(3),
        .asset-table td:nth-child(3),
        .asset-table th:nth-child(4),
        .asset-table td:nth-child(4),
        .asset-table th:nth-child(5),
        .asset-table td:nth-child(5),
        .asset-table th:nth-child(6),
        .asset-table td:nth-child(6) {
          min-width: 100px;
        }
        .asset-table th:nth-child(7),
        .asset-table td:nth-child(7) {
          min-width: 120px;
        }
        .asset-table th:last-child,
        .asset-table td:last-child {
          min-width: 140px;
          text-align: right;
        }

        .action-btn {
          padding: 3px 6px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          transition: all 0.15s;
          font-size: 11px;
          background: transparent;
        }
        @media (min-width: 640px) {
          .action-btn {
            padding: 4px 8px;
            font-size: 13px;
          }
        }
        .action-btn:hover {
          transform: scale(1.1);
        }
        .action-btn.edit:hover {
          background: #dbeafe;
          color: #2563eb;
        }
        .action-btn.delete:hover {
          background: #fee2e2;
          color: #dc2626;
        }
        .action-btn.assign:hover {
          background: #d1fae5;
          color: #059669;
        }
        .action-btn.unassign:hover {
          background: #fef3c7;
          color: #d97706;
        }

        .status-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 99px;
          font-size: 10px;
          font-weight: 600;
        }
        @media (min-width: 640px) {
          .status-badge {
            padding: 3px 10px;
            font-size: 11px;
          }
        }

        .filter-select {
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: white;
          font-size: 12px;
          color: #1f2937;
          outline: none;
          transition: all 0.2s;
          cursor: pointer;
          min-width: 120px;
        }
        @media (min-width: 640px) {
          .filter-select {
            padding: 9px 14px;
            font-size: 13px;
            min-width: 140px;
          }
        }
        .filter-select:focus {
          border-color: #dc2626;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.2);
        }

        .modal-grid-2 {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 640px) {
          .modal-grid-2 {
            grid-template-columns: 1fr 1fr;
            gap: 18px 24px;
          }
        }
        .modal-grid-2 .full-width {
          grid-column: 1 / -1;
        }
        
        .input-icon-wrapper {
          position: relative;
        }
        .input-icon-wrapper .icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          pointer-events: none;
          font-size: 16px;
          line-height: 1;
        }
        .input-icon-wrapper input,
        .input-icon-wrapper textarea,
        .input-icon-wrapper select {
          padding-left: 42px;
          padding-right: 12px;
        }
        .input-icon-wrapper textarea {
          padding-top: 12px;
          padding-bottom: 12px;
          resize: vertical;
          min-height: 52px;
        }
        .input-icon-wrapper .icon-top {
          top: 16px;
          transform: none;
        }
        .input-icon-wrapper select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          padding-right: 40px;
        }

        .image-preview {
          border-radius: 12px;
          overflow: hidden;
          background: #fafbfc;
          border: 1px solid #e2e8f0;
        }
        .image-preview img {
          width: 100%;
          max-height: 200px;
          object-fit: contain;
        }
        .image-thumbnail {
          width: 36px;
          height: 36px;
          object-fit: cover;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }
        @media (min-width: 640px) {
          .image-thumbnail {
            width: 48px;
            height: 48px;
            border-radius: 8px;
          }
        }

        .file-upload-area {
          border: 2px dashed #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          background: #fafbfc;
        }
        @media (min-width: 640px) {
          .file-upload-area {
            padding: 24px;
          }
        }
        .file-upload-area:hover {
          border-color: #dc2626;
          background: #fef2f2;
        }
        .file-upload-area.dragging {
          border-color: #dc2626;
          background: #fef2f2;
        }
        .file-upload-area .upload-icon {
          font-size: 24px;
          margin-bottom: 4px;
        }
        @media (min-width: 640px) {
          .file-upload-area .upload-icon {
            font-size: 32px;
            margin-bottom: 8px;
          }
        }
        .file-upload-area .upload-text {
          color: #64748b;
          font-size: 12px;
        }
        @media (min-width: 640px) {
          .file-upload-area .upload-text {
            font-size: 14px;
          }
        }
        .file-upload-area .upload-subtext {
          color: #94a3b8;
          font-size: 10px;
          margin-top: 2px;
        }
        @media (min-width: 640px) {
          .file-upload-area .upload-subtext {
            font-size: 12px;
            margin-top: 4px;
          }
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 42px;
          height: 22px;
        }
        @media (min-width: 640px) {
          .toggle-switch {
            width: 50px;
            height: 24px;
          }
        }
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: 0.3s;
          border-radius: 24px;
        }
        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }
        @media (min-width: 640px) {
          .toggle-slider:before {
            height: 18px;
            width: 18px;
          }
        }
        input:checked + .toggle-slider {
          background-color: #dc2626;
        }
        input:checked + .toggle-slider:before {
          transform: translateX(20px);
        }
        @media (min-width: 640px) {
          input:checked + .toggle-slider:before {
            transform: translateX(26px);
          }
        }

        .action-cell {
          display: flex;
          flex-wrap: wrap;
          gap: 2px;
          justify-content: flex-end;
        }
        @media (min-width: 640px) {
          .action-cell {
            gap: 4px;
          }
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        @media (min-width: 640px) {
          .stats-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
          }
        }

        .search-filters {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }
        @media (min-width: 640px) {
          .search-filters {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
          }
        }

        .header-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        }
        @media (min-width: 640px) {
          .header-actions {
            flex-direction: row;
            width: auto;
          }
        }

        .bulk-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          min-width: 900px;
        }
        .bulk-table thead th {
          text-align: left;
          padding: 8px 10px;
          font-weight: 600;
          font-size: 10px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 2px solid #f1f5f9;
          background: #fafbfc;
          white-space: nowrap;
        }
        .bulk-table tbody td {
          padding: 8px 10px;
          border-bottom: 1px solid #f1f5f9;
          color: #1f2937;
          font-size: 12px;
          vertical-align: top;
          white-space: nowrap;
        }
        .bulk-table tbody tr.row-error {
          background: #fff7ed;
        }
        .bulk-table tbody tr.row-error:hover {
          background: #ffedd5;
        }
        .bulk-table tbody tr.row-ok:hover {
          background: #f0fdf4;
        }
        .bulk-status-icon {
          font-size: 15px;
        }
        .bulk-error-text {
          color: #dc2626;
          font-size: 10px;
          font-weight: 500;
          white-space: normal;
          max-width: 220px;
        }
        .bulk-summary-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 99px;
          font-size: 11px;
          font-weight: 600;
        }
        @media (min-width: 640px) {
          .bulk-summary-pill {
            font-size: 12px;
          }
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-white via-red-50/15 to-white">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-100/30 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-rose-100/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 sm:mb-6 gap-3 sm:gap-4 fade-in-up">
            <div className="w-full md:w-auto">
              <div className="flex items-center gap-2 sm:gap-3 mb-0.5">
                <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md flex-shrink-0">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    className="sm:w-5 sm:h-5"
                  >
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800">
                    Assets
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5 font-normal">
                    Manage all company assets, assign to departments and users
                  </p>
                </div>
              </div>
            </div>

            <div className="header-actions w-full md:w-auto">
              <button
                onClick={openBulkModal}
                className="cursor-pointer group relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-xs sm:text-sm shadow-sm hover:shadow-md hover:border-red-200 hover:text-red-600 transition-all duration-300 w-full sm:w-auto justify-center"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  className="sm:w-4.5 sm:h-4.5"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Bulk Upload</span>
              </button>

              <button
                onClick={() => setShowModal(true)}
                className="cursor-pointer group relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 overflow-hidden w-full sm:w-auto justify-center"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="group-hover:rotate-90 transition-transform duration-300 sm:w-4.5 sm:h-4.5"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Add Asset</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          {!loading && assets.length > 0 && (
            <div className="stats-grid fade-in-up">
              <div className="stat-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="1.8"
                    className="sm:w-5.5 sm:h-5.5"
                  >
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl sm:text-3xl font-bold text-gray-800">
                    {activeCount}
                  </p>
                  <p className="text-[10px] sm:text-sm font-medium text-gray-500">
                    Total Assets
                  </p>
                </div>
              </div>
              <div className="stat-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth="1.8"
                    className="sm:w-5.5 sm:h-5.5"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl sm:text-3xl font-bold text-gray-800">
                    {availableCount}
                  </p>
                  <p className="text-[10px] sm:text-sm font-medium text-gray-500">
                    Available
                  </p>
                </div>
              </div>
              <div className="stat-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="1.8"
                    className="sm:w-5.5 sm:h-5.5"
                  >
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl sm:text-3xl font-bold text-gray-800">
                    {assignedCount}
                  </p>
                  <p className="text-[10px] sm:text-sm font-medium text-gray-500">
                    Assigned
                  </p>
                </div>
              </div>
              <div className="stat-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center flex-shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6b7280"
                    strokeWidth="1.8"
                    className="sm:w-5.5 sm:h-5.5"
                  >
                    <path d="M12 8v4l3 3" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl sm:text-3xl font-bold text-gray-800">
                    {deactivatedCount}
                  </p>
                  <p className="text-[10px] sm:text-sm font-medium text-gray-500">
                    Deactivated
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Search & Filter */}
          <div className="search-filters fade-in-up">
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <svg
                  className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-900 pointer-events-none"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all shadow-sm text-gray-800 placeholder-gray-400 text-xs sm:text-sm font-normal"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="">All Status</option>
                <option value="AVAILABLE">Available</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="TRANSIT">In Transit</option>
                <option value="DECOMMISSIONED">Decommissioned</option>
              </select>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 bg-white/80 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl shadow-sm border border-gray-100">
              <span
                className={`text-[10px] sm:text-sm font-medium ${!showDeactivated ? "text-red-600" : "text-gray-500"}`}
              >
                Active
              </span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={showDeactivated}
                  onChange={() => setShowDeactivated(!showDeactivated)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span
                className={`text-[10px] sm:text-sm font-medium ${showDeactivated ? "text-red-600" : "text-gray-500"}`}
              >
                Deactivated
              </span>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center py-16 sm:py-20">
              <div className="w-10 h-10 sm:w-12 sm:h-12 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
            </div>
          )}

          {/* Table */}
          {!loading && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden fade-in-up">
              <div className="table-wrapper">
                <table className="asset-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Type</th>
                      <th>Department</th>
                      <th>Location</th>
                      <th>Assigned To</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="text-center py-8 sm:py-12 text-gray-500 text-xs sm:text-sm font-normal"
                        >
                          {searchTerm || statusFilter
                            ? "No assets match your filters"
                            : showDeactivated
                              ? "No deactivated assets found"
                              : "No assets found. Create your first asset!"}
                        </td>
                      </tr>
                    ) : (
                      filteredAssets.map((asset) => (
                        <tr
                          key={asset.id}
                          onClick={() => router.push(`/assets/${asset.id}`)}
                          className="cursor-pointer hover:bg-red-50 transition-colors"
                        >
                          <td>
                            {asset.created_image_url ? (
                              <img
                                src={asset.created_image_url}
                                alt={asset.name}
                                className="image-thumbnail"
                                onError={(e) =>
                                  ((
                                    e.target as HTMLImageElement
                                  ).style.display = "none")
                                }
                              />
                            ) : (
                              <span className="text-gray-400 text-[10px] sm:text-xs">
                                —
                              </span>
                            )}
                          </td>
                          <td className="font-semibold text-gray-900 text-xs sm:text-sm whitespace-nowrap">
                            {asset.name}
                          </td>
                          <td className="text-gray-600 text-xs sm:text-sm">
                            {getCategoryName(asset.category_id)}
                          </td>
                          <td className="text-gray-600 text-xs sm:text-sm">
                            {getTypeName(asset.type_id)}
                          </td>
                          <td className="text-gray-600 text-xs sm:text-sm">
                            {getDepartmentName(asset.department_id)}
                          </td>
                          <td className="text-gray-600 text-xs sm:text-sm">
                            {asset.location_id ? (
                              <span className="text-[10px] sm:text-xs text-gray-600">
                                {getLocationName(asset.location_id)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="text-gray-600 text-xs sm:text-sm whitespace-nowrap">
                            {getUserName(asset.assigned_to_user_id)}
                          </td>
                          <td className="whitespace-nowrap">
                            <span
                              className={`status-badge ${getStatusBadge(asset.status)}`}
                            >
                              {asset.status || "AVAILABLE"}
                            </span>
                          </td>
                          <td>
                            <div className="action-cell">
                              {asset.assigned_to_user_id ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnassignAsset(asset);
                                  }}
                                  className="action-btn unassign"
                                  title="Unassign"
                                  disabled={submitting}
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className="sm:w-4.5 sm:h-4.5"
                                  >
                                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                                    <path d="M16 3.13a4 4 0 010 7.75" />
                                    <line x1="16" y1="8" x2="22" y2="14" />
                                    <line x1="22" y1="8" x2="16" y2="14" />
                                  </svg>
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAssignModal(asset);
                                  }}
                                  className="action-btn assign"
                                  title="Assign"
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className="sm:w-4.5 sm:h-4.5"
                                  >
                                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                                    <path d="M16 3.13a4 4 0 010 7.75" />
                                    <path d="M16 8l6 6" />
                                    <path d="M22 8l-6 6" />
                                  </svg>
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(asset);
                                }}
                                className="action-btn edit"
                                title="Edit"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  className="sm:w-4.5 sm:h-4.5"
                                >
                                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              {asset.is_active !== false && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDeleteConfirm(asset);
                                  }}
                                  className="action-btn delete"
                                  title="Deactivate"
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className="sm:w-4.5 sm:h-4.5"
                                  >
                                    <path d="M3 6h18" />
                                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE ASSET MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                  Create Asset
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5 font-normal">
                  Add a new asset to the system
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="cursor-pointer text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-gray-100 flex-shrink-0"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="sm:w-4 sm:h-4"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateAsset}>
              <div className="modal-grid-2">
                {/* Asset Name - full width */}
                <div className="full-width">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Asset Name <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">🏷️</span>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        if (formErrors.name)
                          setFormErrors({ ...formErrors, name: "" });
                      }}
                      required
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-xs sm:text-sm font-normal ${
                        formErrors.name
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                      placeholder="Dell Latitude 5440"
                    />
                  </div>
                  {formErrors.name && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {formErrors.name}
                    </p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">📂</span>
                    <select
                      value={formData.category_id}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          category_id: e.target.value,
                          type_id: "",
                        });
                        if (formErrors.category_id)
                          setFormErrors({ ...formErrors, category_id: "" });
                      }}
                      required
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white text-gray-800 text-xs sm:text-sm font-normal ${
                        formErrors.category_id
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                    >
                      <option value="">Select Category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {formErrors.category_id && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {formErrors.category_id}
                    </p>
                  )}
                </div>

                {/* Type */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">🔧</span>
                    <select
                      value={formData.type_id}
                      onChange={(e) => {
                        setFormData({ ...formData, type_id: e.target.value });
                        if (formErrors.type_id)
                          setFormErrors({ ...formErrors, type_id: "" });
                      }}
                      required
                      disabled={!formData.category_id}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white text-gray-800 text-xs sm:text-sm font-normal disabled:opacity-50 disabled:cursor-not-allowed ${
                        formErrors.type_id
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                    >
                      <option value="">
                        {formData.category_id
                          ? "Select Type"
                          : "Select Category First"}
                      </option>
                      {filteredTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {formErrors.type_id && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {formErrors.type_id}
                    </p>
                  )}
                </div>

                {/* Description - full width */}
                <div className="full-width">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Description
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon icon-top">📝</span>
                    <textarea
                      value={formData.description}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        });
                        if (formErrors.description)
                          setFormErrors({ ...formErrors, description: "" });
                      }}
                      rows={2}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all resize-none input-fancy text-gray-800 placeholder-gray-400 text-xs sm:text-sm font-normal ${
                        formErrors.description
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                      placeholder="Optional description"
                    />
                  </div>
                  {formErrors.description && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {formErrors.description}
                    </p>
                  )}
                </div>

                {/* Serial Number */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Serial Number
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">🔢</span>
                    <input
                      type="text"
                      value={formData.serial_number}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          serial_number: e.target.value,
                        });
                        if (formErrors.serial_number)
                          setFormErrors({ ...formErrors, serial_number: "" });
                      }}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-xs sm:text-sm font-normal ${
                        formErrors.serial_number
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                      placeholder="SN-12345"
                    />
                  </div>
                  {formErrors.serial_number && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {formErrors.serial_number}
                    </p>
                  )}
                </div>

                {/* Model */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Model
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">📟</span>
                    <input
                      type="text"
                      value={formData.model}
                      onChange={(e) => {
                        setFormData({ ...formData, model: e.target.value });
                        if (formErrors.model)
                          setFormErrors({ ...formErrors, model: "" });
                      }}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-xs sm:text-sm font-normal ${
                        formErrors.model
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                      placeholder="Latitude 5440"
                    />
                  </div>
                  {formErrors.model && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {formErrors.model}
                    </p>
                  )}
                </div>

                {/* Manufacturer */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Manufacturer
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">🏭</span>
                    <input
                      type="text"
                      value={formData.manufacturer}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          manufacturer: e.target.value,
                        });
                        if (formErrors.manufacturer)
                          setFormErrors({ ...formErrors, manufacturer: "" });
                      }}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-xs sm:text-sm font-normal ${
                        formErrors.manufacturer
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                      placeholder="Dell"
                    />
                  </div>
                  {formErrors.manufacturer && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {formErrors.manufacturer}
                    </p>
                  )}
                </div>

                {/* Department */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Department
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">🏛️</span>
                    <select
                      value={formData.department_id}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          department_id: e.target.value,
                        });
                        if (formErrors.department_id)
                          setFormErrors({ ...formErrors, department_id: "" });
                      }}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white text-gray-800 text-xs sm:text-sm font-normal ${
                        formErrors.department_id
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                    >
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {formErrors.department_id && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {formErrors.department_id}
                    </p>
                  )}
                </div>

                {/* Assigned To */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Assigned To
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">👤</span>
                    <select
                      value={formData.assigned_to_user_id}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          assigned_to_user_id: e.target.value,
                        });
                        if (formErrors.assigned_to_user_id)
                          setFormErrors({
                            ...formErrors,
                            assigned_to_user_id: "",
                          });
                      }}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white text-gray-800 text-xs sm:text-sm font-normal ${
                        formErrors.assigned_to_user_id
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                    >
                      <option value="">Select User</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {formErrors.assigned_to_user_id && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {formErrors.assigned_to_user_id}
                    </p>
                  )}
                </div>

                {/* Location */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Location
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">📍</span>
                    <select
                      value={formData.location_id}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          location_id: e.target.value,
                        });
                        if (formErrors.location_id)
                          setFormErrors({ ...formErrors, location_id: "" });
                      }}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white text-gray-800 text-xs sm:text-sm font-normal ${
                        formErrors.location_id
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                    >
                      <option value="">Select Location</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.full_path} ({loc.location_type})
                        </option>
                      ))}
                    </select>
                  </div>
                  {formErrors.location_id && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {formErrors.location_id}
                    </p>
                  )}
                </div>

                {/* Purchase Date */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Purchase Date
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">📅</span>
                    <input
                      type="date"
                      value={formData.purchase_date}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          purchase_date: e.target.value,
                        });
                        if (formErrors.purchase_date)
                          setFormErrors({ ...formErrors, purchase_date: "" });
                      }}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 text-xs sm:text-sm font-normal ${
                        formErrors.purchase_date
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                    />
                  </div>
                  {formErrors.purchase_date && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {formErrors.purchase_date}
                    </p>
                  )}
                </div>

                {/* Purchase Value */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Purchase Value ($)
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">💰</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.purchase_value}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          purchase_value: e.target.value,
                        });
                        if (formErrors.purchase_value)
                          setFormErrors({ ...formErrors, purchase_value: "" });
                      }}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-xs sm:text-sm font-normal ${
                        formErrors.purchase_value
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                      placeholder="0.00"
                    />
                  </div>
                  {formErrors.purchase_value && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {formErrors.purchase_value}
                    </p>
                  )}
                </div>

                {/* NEW: Simple Image Upload */}
                <div className="full-width">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Asset Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="file-upload-area cursor-pointer block"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add("dragging");
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove("dragging");
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove("dragging");
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        const input = document.getElementById(
                          "image-upload",
                        ) as HTMLInputElement;
                        const dt = new DataTransfer();
                        dt.items.add(file);
                        input.files = dt.files;
                        handleImageSelect({ target: input } as any);
                      }
                    }}
                  >
                    {imageFile ? (
                      <div className="flex items-center justify-center gap-2 sm:gap-3 py-1 sm:py-2">
                        <span className="text-green-500 text-lg sm:text-xl">
                          ✅
                        </span>
                        <span className="text-xs sm:text-sm text-gray-600 font-medium">
                          {imageFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage();
                            const input = document.getElementById(
                              "image-upload",
                            ) as HTMLInputElement;
                            if (input) input.value = "";
                          }}
                          className="text-red-500 hover:text-red-700 text-xs font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="upload-icon">🖼️</div>
                        <p className="upload-text">
                          Click or drag to upload image
                        </p>
                        <p className="upload-subtext">
                          PNG, JPG, JPEG up to 5MB
                        </p>
                      </div>
                    )}
                  </label>

                  {imagePreview && (
                    <div className="image-preview p-1.5 sm:p-2 mt-2 sm:mt-3">
                      <img
                        src={imagePreview}
                        alt="Asset preview"
                        className="w-full max-h-36 sm:max-h-48 object-contain"
                        onError={() => setImagePreview("")}
                      />
                    </div>
                  )}
                </div>

                {/* Status - full width */}
                <div className="full-width">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">📊</span>
                    <select
                      value={formData.status}
                      onChange={(e) => {
                        setFormData({ ...formData, status: e.target.value });
                        if (formErrors.status)
                          setFormErrors({ ...formErrors, status: "" });
                      }}
                      required
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white text-gray-800 text-xs sm:text-sm font-normal ${
                        formErrors.status
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-red-400/50"
                      }`}
                    >
                      <option value="AVAILABLE">Available</option>
                      <option value="ASSIGNED">Assigned</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="TRANSIT">In Transit</option>
                      <option value="DECOMMISSIONED">Decommissioned</option>
                    </select>
                  </div>
                  {formErrors.status && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {formErrors.status}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 sm:pt-6 mt-2 sm:mt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="cursor-pointer flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-xs sm:text-sm order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="cursor-pointer flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm shadow-md order-1 sm:order-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                      Creating...
                    </>
                  ) : (
                    "Create Asset"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ASSET MODAL */}
      {showEditModal && selectedAsset && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                  Edit Asset
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5 font-normal">
                  Update asset details
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-gray-100 flex-shrink-0"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="sm:w-4 sm:h-4"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateAsset}>
              <div className="modal-grid-2">
                {/* Asset Name - full width */}
                <div className="full-width">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Asset Name <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">🏷️</span>
                    <input
                      type="text"
                      value={editFormData.name}
                      onChange={(e) => {
                        setEditFormData({
                          ...editFormData,
                          name: e.target.value,
                        });
                        if (editErrors.name)
                          setEditErrors({ ...editErrors, name: "" });
                      }}
                      required
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-xs sm:text-sm font-normal ${
                        editErrors.name
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-amber-400/50"
                      }`}
                    />
                  </div>
                  {editErrors.name && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {editErrors.name}
                    </p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">📂</span>
                    <select
                      value={editFormData.category_id}
                      onChange={(e) => {
                        setEditFormData({
                          ...editFormData,
                          category_id: e.target.value,
                          type_id: "",
                        });
                        if (editErrors.category_id)
                          setEditErrors({ ...editErrors, category_id: "" });
                      }}
                      required
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white text-gray-800 text-xs sm:text-sm font-normal ${
                        editErrors.category_id
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-amber-400/50"
                      }`}
                    >
                      <option value="">Select Category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {editErrors.category_id && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {editErrors.category_id}
                    </p>
                  )}
                </div>

                {/* Type */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">🔧</span>
                    <select
                      value={editFormData.type_id}
                      onChange={(e) => {
                        setEditFormData({
                          ...editFormData,
                          type_id: e.target.value,
                        });
                        if (editErrors.type_id)
                          setEditErrors({ ...editErrors, type_id: "" });
                      }}
                      required
                      disabled={!editFormData.category_id}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white text-gray-800 text-xs sm:text-sm font-normal disabled:opacity-50 disabled:cursor-not-allowed ${
                        editErrors.type_id
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-amber-400/50"
                      }`}
                    >
                      <option value="">
                        {editFormData.category_id
                          ? "Select Type"
                          : "Select Category First"}
                      </option>
                      {filteredTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {editErrors.type_id && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {editErrors.type_id}
                    </p>
                  )}
                </div>

                {/* Description - full width */}
                <div className="full-width">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Description
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon icon-top">📝</span>
                    <textarea
                      value={editFormData.description}
                      onChange={(e) => {
                        setEditFormData({
                          ...editFormData,
                          description: e.target.value,
                        });
                        if (editErrors.description)
                          setEditErrors({ ...editErrors, description: "" });
                      }}
                      rows={2}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all resize-none input-fancy text-gray-800 placeholder-gray-400 text-xs sm:text-sm font-normal ${
                        editErrors.description
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-amber-400/50"
                      }`}
                      placeholder="Optional description"
                    />
                  </div>
                  {editErrors.description && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {editErrors.description}
                    </p>
                  )}
                </div>

                {/* Serial Number */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Serial Number
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">🔢</span>
                    <input
                      type="text"
                      value={editFormData.serial_number}
                      onChange={(e) => {
                        setEditFormData({
                          ...editFormData,
                          serial_number: e.target.value,
                        });
                        if (editErrors.serial_number)
                          setEditErrors({ ...editErrors, serial_number: "" });
                      }}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-xs sm:text-sm font-normal ${
                        editErrors.serial_number
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-amber-400/50"
                      }`}
                    />
                  </div>
                  {editErrors.serial_number && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {editErrors.serial_number}
                    </p>
                  )}
                </div>

                {/* Model */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Model
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">📟</span>
                    <input
                      type="text"
                      value={editFormData.model}
                      onChange={(e) => {
                        setEditFormData({
                          ...editFormData,
                          model: e.target.value,
                        });
                        if (editErrors.model)
                          setEditErrors({ ...editErrors, model: "" });
                      }}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-xs sm:text-sm font-normal ${
                        editErrors.model
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-amber-400/50"
                      }`}
                    />
                  </div>
                  {editErrors.model && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {editErrors.model}
                    </p>
                  )}
                </div>

                {/* Manufacturer */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Manufacturer
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">🏭</span>
                    <input
                      type="text"
                      value={editFormData.manufacturer}
                      onChange={(e) => {
                        setEditFormData({
                          ...editFormData,
                          manufacturer: e.target.value,
                        });
                        if (editErrors.manufacturer)
                          setEditErrors({ ...editErrors, manufacturer: "" });
                      }}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-xs sm:text-sm font-normal ${
                        editErrors.manufacturer
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-amber-400/50"
                      }`}
                    />
                  </div>
                  {editErrors.manufacturer && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {editErrors.manufacturer}
                    </p>
                  )}
                </div>

                {/* Department */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Department
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">🏛️</span>
                    <select
                      value={editFormData.department_id}
                      onChange={(e) => {
                        setEditFormData({
                          ...editFormData,
                          department_id: e.target.value,
                        });
                        if (editErrors.department_id)
                          setEditErrors({ ...editErrors, department_id: "" });
                      }}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white text-gray-800 text-xs sm:text-sm font-normal ${
                        editErrors.department_id
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-amber-400/50"
                      }`}
                    >
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {editErrors.department_id && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {editErrors.department_id}
                    </p>
                  )}
                </div>

                {/* Assigned To */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Assigned To
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">👤</span>
                    <select
                      value={editFormData.assigned_to_user_id}
                      onChange={(e) => {
                        setEditFormData({
                          ...editFormData,
                          assigned_to_user_id: e.target.value,
                        });
                        if (editErrors.assigned_to_user_id)
                          setEditErrors({
                            ...editErrors,
                            assigned_to_user_id: "",
                          });
                      }}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white text-gray-800 text-xs sm:text-sm font-normal ${
                        editErrors.assigned_to_user_id
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-amber-400/50"
                      }`}
                    >
                      <option value="">Select User</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {editErrors.assigned_to_user_id && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {editErrors.assigned_to_user_id}
                    </p>
                  )}
                </div>

                {/* Location */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Location
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">📍</span>
                    <select
                      value={editFormData.location_id}
                      onChange={(e) => {
                        setEditFormData({
                          ...editFormData,
                          location_id: e.target.value,
                        });
                        if (editErrors.location_id)
                          setEditErrors({ ...editErrors, location_id: "" });
                      }}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white text-gray-800 text-xs sm:text-sm font-normal ${
                        editErrors.location_id
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-amber-400/50"
                      }`}
                    >
                      <option value="">Select Location</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.full_path} ({loc.location_type})
                        </option>
                      ))}
                    </select>
                  </div>
                  {editErrors.location_id && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {editErrors.location_id}
                    </p>
                  )}
                </div>

                {/* Purchase Date */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Purchase Date
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">📅</span>
                    <input
                      type="date"
                      value={editFormData.purchase_date}
                      onChange={(e) => {
                        setEditFormData({
                          ...editFormData,
                          purchase_date: e.target.value,
                        });
                        if (editErrors.purchase_date)
                          setEditErrors({ ...editErrors, purchase_date: "" });
                      }}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 text-xs sm:text-sm font-normal ${
                        editErrors.purchase_date
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-amber-400/50"
                      }`}
                    />
                  </div>
                  {editErrors.purchase_date && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {editErrors.purchase_date}
                    </p>
                  )}
                </div>

                {/* Purchase Value */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Purchase Value ($)
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">💰</span>
                    <input
                      type="number"
                      step="0.01"
                      value={editFormData.purchase_value}
                      onChange={(e) => {
                        setEditFormData({
                          ...editFormData,
                          purchase_value: e.target.value,
                        });
                        if (editErrors.purchase_value)
                          setEditErrors({ ...editErrors, purchase_value: "" });
                      }}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all input-fancy text-gray-800 placeholder-gray-400 text-xs sm:text-sm font-normal ${
                        editErrors.purchase_value
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-amber-400/50"
                      }`}
                      placeholder="0.00"
                    />
                  </div>
                  {editErrors.purchase_value && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {editErrors.purchase_value}
                    </p>
                  )}
                </div>

                {/* NEW: Simple Image Upload for Edit */}
                <div className="full-width">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Asset Image
                  </label>

                  {selectedAsset.created_image_url && !editImageFile && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-500 mb-1">
                        Current Image:
                      </p>
                      <img
                        src={selectedAsset.created_image_url}
                        alt="Current asset"
                        className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                        onError={(e) =>
                          (e.currentTarget.style.display = "none")
                        }
                      />
                    </div>
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEditImageSelect}
                    className="hidden"
                    id="edit-image-upload"
                  />

                  <label
                    htmlFor="edit-image-upload"
                    className="file-upload-area cursor-pointer block"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add("dragging");
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove("dragging");
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove("dragging");
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        const input = document.getElementById(
                          "edit-image-upload",
                        ) as HTMLInputElement;
                        const dt = new DataTransfer();
                        dt.items.add(file);
                        input.files = dt.files;
                        handleEditImageSelect({ target: input } as any);
                      }
                    }}
                  >
                    {editImageFile ? (
                      <div className="flex items-center justify-center gap-2 sm:gap-3 py-1 sm:py-2">
                        <span className="text-green-500 text-lg sm:text-xl">
                          ✅
                        </span>
                        <span className="text-xs sm:text-sm text-gray-600 font-medium">
                          {editImageFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeEditImage();
                            const input = document.getElementById(
                              "edit-image-upload",
                            ) as HTMLInputElement;
                            if (input) input.value = "";
                          }}
                          className="text-red-500 hover:text-red-700 text-xs font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="upload-icon">🖼️</div>
                        <p className="upload-text">
                          Click or drag to upload new image
                        </p>
                        <p className="upload-subtext">
                          PNG, JPG, JPEG up to 5MB
                        </p>
                      </div>
                    )}
                  </label>

                  {editImagePreview && (
                    <div className="image-preview p-1.5 sm:p-2 mt-2 sm:mt-3">
                      <img
                        src={editImagePreview}
                        alt="Asset preview"
                        className="w-full max-h-36 sm:max-h-48 object-contain"
                        onError={() => setEditImagePreview("")}
                      />
                    </div>
                  )}
                </div>

                {/* Status - full width */}
                <div className="full-width">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">📊</span>
                    <select
                      value={editFormData.status}
                      onChange={(e) => {
                        setEditFormData({
                          ...editFormData,
                          status: e.target.value,
                        });
                        if (editErrors.status)
                          setEditErrors({ ...editErrors, status: "" });
                      }}
                      required
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white text-gray-800 text-xs sm:text-sm font-normal ${
                        editErrors.status
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-amber-400/50"
                      }`}
                    >
                      <option value="AVAILABLE">Available</option>
                      <option value="ASSIGNED">Assigned</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="TRANSIT">In Transit</option>
                      <option value="DECOMMISSIONED">Decommissioned</option>
                    </select>
                  </div>
                  {editErrors.status && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {editErrors.status}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 sm:pt-6 mt-2 sm:mt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-xs sm:text-sm order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm shadow-md order-1 sm:order-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                      Updating...
                    </>
                  ) : (
                    "Update Asset"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN MODAL */}
      {showAssignModal && selectedAsset && (
        <div
          className="modal-overlay"
          onClick={() => setShowAssignModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                  Assign Asset
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5 font-normal">
                  Assign{" "}
                  <span className="font-semibold">{selectedAsset.name}</span> to
                  a user
                </p>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-gray-100 flex-shrink-0"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="sm:w-4 sm:h-4"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAssignAsset}>
              <div className="modal-grid-2">
                <div className="full-width">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Select User <span className="text-red-500">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="icon">👤</span>
                    <select
                      value={assignFormData.user_id}
                      onChange={(e) => {
                        setAssignFormData({
                          ...assignFormData,
                          user_id: e.target.value,
                        });
                        if (assignErrors.user_id)
                          setAssignErrors({ ...assignErrors, user_id: "" });
                      }}
                      required
                      className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white text-gray-800 text-xs sm:text-sm font-normal ${
                        assignErrors.user_id
                          ? "border-red-500 focus:ring-red-400/50"
                          : "border-gray-200 focus:ring-green-400/50"
                      }`}
                    >
                      <option value="">Select a user</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.full_name} ({user.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  {assignErrors.user_id && (
                    <p className="text-red-500 text-[10px] sm:text-xs mt-1.5 font-medium">
                      {assignErrors.user_id}
                    </p>
                  )}
                </div>

                <div className="full-width">
                  <div className="bg-green-50 rounded-xl p-3 sm:p-4 border border-green-200">
                    <p className="text-xs sm:text-sm text-green-700 font-medium">
                      <span className="font-bold">Note:</span> Assigning this
                      asset will change its status to "ASSIGNED".
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 sm:pt-6 mt-2 sm:mt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-xs sm:text-sm order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm shadow-md order-1 sm:order-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                      Assigning...
                    </>
                  ) : (
                    "Assign Asset"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {showDeleteConfirm && selectedAsset && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="modal-content delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2"
                  className="sm:w-7 sm:h-7"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-1.5 sm:mb-2">
                Deactivate Asset?
              </h3>
              <p className="text-gray-500 text-xs sm:text-sm mb-2 font-normal">
                Are you sure you want to deactivate{" "}
                <span className="font-semibold text-gray-700">
                  {selectedAsset.name}
                </span>
                ?
              </p>
              <p className="text-[10px] sm:text-xs text-gray-400 mb-4 sm:mb-6 font-normal">
                This will hide the asset from active lists. This action can be
                reversed.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-xs sm:text-sm order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAsset}
                  disabled={submitting}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm shadow-md order-1 sm:order-2"
                >
                  {submitting ? (
                    <span className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Yes, Deactivate"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BULK UPLOAD MODAL */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={closeBulkModal}>
          <div
            className="modal-content bulk-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                  Bulk Upload Assets
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5 font-normal">
                  Upload an Excel file to create multiple assets at once
                </p>
              </div>
              <button
                onClick={closeBulkModal}
                className="cursor-pointer text-gray-400 hover:text-gray-600 transition-all duration-200 hover:rotate-90 transform w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-gray-100 flex-shrink-0"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="sm:w-4 sm:h-4"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-4">
              <p className="text-[10px] sm:text-xs text-gray-500 font-normal">
                Required columns: <span className="font-semibold text-gray-700">category_id, type_id, name</span>.
                Optional: department_id, location_id, assigned_to_user_id, description, serial_number, model, manufacturer, purchase_date (YYYY-MM-DD), purchase_value.
              </p>
              <button
                type="button"
                onClick={downloadBulkTemplate}
                className="cursor-pointer flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-[10px] sm:text-xs font-semibold whitespace-nowrap"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Template
              </button>
            </div>

            {/* Client ID - only needed for platform ADMIN accounts */}
            <div className="mb-3 sm:mb-4">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                Client ID{" "}
                <span className="text-gray-400 font-normal">
                  (only required for ADMIN / Platform Admin accounts)
                </span>
              </label>
              <div className="input-icon-wrapper">
                <span className="icon">🏢</span>
                <input
                  type="text"
                  value={bulkClientId}
                  onChange={(e) => setBulkClientId(e.target.value)}
                  placeholder="Leave blank if you're a CLIENT_ADMIN or Manager"
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 pl-9 sm:pl-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-all input-fancy text-gray-800 placeholder-gray-400 text-xs sm:text-sm font-normal"
                />
              </div>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-1.5 font-normal">
                CLIENT_ADMIN and Manager accounts don't need this — the backend reads your client from your login token automatically.
              </p>
            </div>

            {/* File upload area */}
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleBulkFileSelect}
              className="hidden"
              id="bulk-upload"
            />
            <label
              htmlFor="bulk-upload"
              className={`file-upload-area cursor-pointer block ${bulkDragging ? "dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setBulkDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setBulkDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setBulkDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  const input = document.getElementById(
                    "bulk-upload",
                  ) as HTMLInputElement;
                  const dt = new DataTransfer();
                  dt.items.add(file);
                  input.files = dt.files;
                  handleBulkFileSelect({ target: input } as any);
                }
              }}
            >
              {bulkFile ? (
                <div className="flex items-center justify-center gap-2 sm:gap-3 py-1 sm:py-2 flex-wrap">
                  <span className="text-green-500 text-lg sm:text-xl">📊</span>
                  <span className="text-xs sm:text-sm text-gray-600 font-medium">
                    {bulkFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBulkFile();
                      const input = document.getElementById(
                        "bulk-upload",
                      ) as HTMLInputElement;
                      if (input) input.value = "";
                    }}
                    className="text-red-500 hover:text-red-700 text-xs font-medium"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <div className="upload-icon">📊</div>
                  <p className="upload-text">
                    Click or drag to upload Excel file
                  </p>
                  <p className="upload-subtext">XLSX or XLS format</p>
                </div>
              )}
            </label>

            {/* Parsing indicator */}
            {bulkParsing && (
              <div className="flex justify-center items-center py-8">
                <div className="w-8 h-8 border-3 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
              </div>
            )}

            {/* Preview table */}
            {!bulkParsing && bulkRows.length > 0 && (
              <div className="mt-4 sm:mt-5">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="bulk-summary-pill bg-gray-100 text-gray-700">
                    {bulkRows.length} row{bulkRows.length === 1 ? "" : "s"} parsed
                  </span>
                  <span className="bulk-summary-pill bg-green-100 text-green-700">
                    ✅ {bulkValidCount} valid
                  </span>
                  {bulkErrorCount > 0 && (
                    <span className="bulk-summary-pill bg-orange-100 text-orange-700">
                      ⚠️ {bulkErrorCount} with errors
                    </span>
                  )}
                </div>

                <div className="table-wrapper border border-gray-100 rounded-xl">
                  <table className="bulk-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Status</th>
                        <th>Name</th>
                        <th>Category ID</th>
                        <th>Type ID</th>
                        <th>Department ID</th>
                        <th>Location ID</th>
                        <th>Assigned User ID</th>
                        <th>Serial #</th>
                        <th>Purchase Date</th>
                        <th>Purchase Value</th>
                        <th>Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row) => (
                        <tr
                          key={row.rowNumber}
                          className={
                            row.errors.length > 0 ? "row-error" : "row-ok"
                          }
                        >
                          <td>{row.rowNumber}</td>
                          <td>
                            <span className="bulk-status-icon">
                              {row.errors.length > 0 ? "⚠️" : "✅"}
                            </span>
                          </td>
                          <td>{row.name || "—"}</td>
                          <td>{row.category_id || "—"}</td>
                          <td>{row.type_id || "—"}</td>
                          <td>{row.department_id || "—"}</td>
                          <td>{row.location_id || "—"}</td>
                          <td>{row.assigned_to_user_id || "—"}</td>
                          <td>{row.serial_number || "—"}</td>
                          <td>{row.purchase_date || "—"}</td>
                          <td>{row.purchase_value || "—"}</td>
                          <td>
                            {row.errors.length > 0 ? (
                              <span className="bulk-error-text">
                                {row.errors.join("; ")}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 sm:pt-6 mt-4 sm:mt-5 border-t border-gray-100">
              <button
                type="button"
                onClick={closeBulkModal}
                className="cursor-pointer flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-xs sm:text-sm order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkCreate}
                disabled={bulkHasBlockingErrors || bulkSubmitting || bulkParsing}
                className="cursor-pointer flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold text-xs sm:text-sm shadow-md order-1 sm:order-2"
              >
                {bulkSubmitting ? (
                  <>
                    <span className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{" "}
                    Creating...
                  </>
                ) : (
                  `Create ${bulkRows.length > 0 ? bulkRows.length : ""} Asset${bulkRows.length === 1 ? "" : "s"}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}