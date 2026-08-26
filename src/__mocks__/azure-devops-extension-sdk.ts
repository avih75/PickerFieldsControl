const SDK = {
  init: jest.fn().mockResolvedValue(undefined),
  notifyLoadSucceeded: jest.fn(),
  getService: jest.fn(),
  getExtensionContext: jest.fn().mockReturnValue({ id: "AviHadad.Picker-Fields-Control" }),
  getAccessToken: jest.fn().mockResolvedValue("test-token"),
  getConfiguration: jest.fn().mockReturnValue({ witInputs: {} }),
  getWebContext: jest.fn().mockReturnValue({ project: { name: "TestProject" } }),
};
export default SDK;
export const { init, notifyLoadSucceeded, getService, getExtensionContext, getAccessToken, getConfiguration, getWebContext } = SDK;
