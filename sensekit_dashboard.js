$(document).ready(function() {
  // constants
  const refreshDataRate = 1000;
  const searchRate = 1000;
  const agentAddress = "https://agent.electricimp.com/Q55EE8z8iNZE";

  // variables
  var devices = {};
  var dataRefreshLoop;
  var connectedDevicesLoop;
  var sidebarRefresh;

  // sidebar listeners
  $(".nav-sidebar").on("click", "li", loadDashboard);
  $("#disconnect").on("click", disconnectDevice);

  // look for available devices
  pollForActiveDevices();

  //look for connected devices
  pollForConnectedDevices();


  ////// Page Functions //////

  //// Device Sidebar
  function updateActiveDeviceList(activeId) {
    for(device in devices) {
      $(".devices ul").append("<li data-id='" + device + "'><a href='#'>Device Id: " + device + "  RSSI: " + devices[device] + "</a></li>");
      if(activeId) {
        $("li[data-id="+activeId+"]").addClass("active");
      }
    }
  }

  function clearActiveDeviceList() {
    $(".devices ul").html("");
  }

  function checkSidebarActive() {
    return ($(".sidebar .active").length > 0) ? $(".sidebar .active").data().id : "";
  }

  function disconnectDevice(e) {
    e.preventDefault();
    disconnectFromDevice();
    clearDataRefreshLoop();
    pollForConnectedDevices();
    $(".sidebar .active").removeClass("active");
  }

  //// Dashboard
  function loadDashboard(e) {
    e.preventDefault();
    var devId = e.currentTarget.dataset.id;
    updateSidebarStatus(devId);
    connectToDevice(devId);
  }

  function checkConnection(deviceId) {
    if (deviceId.search(/null/) === -1) {
      console.log("connected to :");
      console.log(deviceId);
      updateSidebarStatus(deviceId);
      showDisconnectButton();
      window.clearInterval(connectedDevicesLoop);
      getData();
    } else {
      showPressSensorButtonMsg();
    }
  }

  function showPressSensorButtonMsg() {
    console.log("press button on sensor!!");
    //add condition to only reset page if in connected state
  }

  function getData() {
    if (!dataRefreshLoop) {
      console.log("in getData make a refresh loop");
      dataRefreshLoop = window.setInterval(function() {getSensorData(); }, refreshDataRate);
    }
  };

  function updateDashboard(data) {
    console.log(data);
  };

  function showDisconnectButton() {
    $("#disconnect").removeClass("hidden");
  };

  function hideDisconnectButton() {
    $("#disconnect").addClass("hidden");
  };

  function updateSidebarStatus(deviceId) {
    $(".active").removeClass("active");
    $("[data-id=" + deviceId + "]").addClass("active");
  };

  //// Helpers
  function getCurrentTime() {
    return (new Date()).toLocaleTimeString()
  }

  function updateCurrentTime(timeDiv) {
    timeDiv.text("Devices Updated at " +getCurrentTime());
  }

  function pollForConnectedDevices() {
    connectedDevicesLoop = window.setInterval(function() { getConnectedDevice(); }, searchRate);
  }

  function pollForActiveDevices() {
    sidebarRefresh = window.setInterval(function() { getDevices() }, searchRate);
  }

  function clearDataRefreshLoop() {
    window.clearInterval(dataRefreshLoop);
    dataRefreshLoop = undefined;
  }

  ////// API Ajax requests //////

  //request avialable devices
  function getDevices() {
    $.ajax({
      url : agentAddress + "/listdevs",
      dataType : "json",
      success : function(response) {
        if (JSON.stringify(response) != JSON.stringify(devices)) {
          console.log("updating list");
          var activeId = checkSidebarActive();
          devices = response;
          clearActiveDeviceList();
          updateActiveDeviceList(activeId);
        }
        updateCurrentTime($(".devices .time"));
      }
    });
  }

  //request connected device
  // returns deviceId or "(null :(nil))"
  function getConnectedDevice() {
    $.ajax({
      url : agentAddress + "/getconnecteddev",
      success : function(response) {
        checkConnection(response)
      }
    });
  }


  //connect to a device
  function connectToDevice(devId) {
    $.ajax({
      url : agentAddress + "/connectto",
      type: "post",
      data: devId,
      success : function(response) {
        console.log(response);
        window.setTimeout(function() { getConnectedDevice(); }, 500);
      }
    });
  }

  //disconnect from a device
  function disconnectFromDevice() {
    console.log("in disconnect")
    $.ajax({
      url : agentAddress + "/disconnect",
      success : function(response) {
        console.log(response);
        hideDisconnectButton();
      }
    });
  }

  //get data from connected device
  function getSensorData() {
    $.ajax({
      url : agentAddress + "/getupdate",
      dataType : "json",
      success : function(response) {
        updateDashboard(response);
        //response should look like
        // { "press": 1002.2, "humid": 22.4, "gyro": [ -104, 476, -462 ], "batt": 21, "temp": 21.6, "accel": [ [ 1, 0, 86 ], [ 1, -1, 87 ], [ 1, -1, 86 ], [ 2, -1, 86 ], [ 2, -1, 86 ], [ 1, 0, 86 ], [ 0, -1, 87 ], [ 2, -1, 86 ], [ 1, -1, 86 ], [ 2, -1, 86 ] ], "mag": [ -554, 903, -2347 ] }
      }
    });
  }

})